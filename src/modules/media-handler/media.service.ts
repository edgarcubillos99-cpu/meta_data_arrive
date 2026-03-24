import { Injectable, Logger, BadRequestException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { promises as fsPromises, createWriteStream } from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as NodeClam from 'clamscan';

const ALLOWED_MIME_SIGNATURES: Record<string, { mime: string; ext: string }> = {
  'ffd8ff': { mime: 'image/jpeg', ext: 'jpg' },
  '89504e47': { mime: 'image/png', ext: 'png' },
  '25504446': { mime: 'application/pdf', ext: 'pdf' },
  '4f676753': { mime: 'audio/ogg', ext: 'ogg' }, // Usado por WhatsApp para notas de voz
  'd0cf11e0': { mime: 'application/msword', ext: 'doc' },
  '504b0304': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
};

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'attachments');

@Injectable()
export class MediaService implements OnModuleInit { // Implementar OnModuleInit
  private clamscan: NodeClam.Clamscan;
  private readonly logger = new Logger(MediaService.name);

  constructor() {
    this.ensureUploadsDir();
  }

  private async ensureUploadsDir(): Promise<void> {
    await fsPromises.mkdir(UPLOADS_DIR, { recursive: true });
  }

  private detectMimeType(buffer: Buffer): { mime: string; ext: string } | null {
    const hex = buffer.subarray(0, 4).toString('hex');
    for (const [signature, typeInfo] of Object.entries(ALLOWED_MIME_SIGNATURES)) {
      if (hex.startsWith(signature)) return typeInfo;
    }
    return null;
  }

  async onModuleInit() {
    const clamPort = parseInt(String(process.env.CLAMAV_PORT || '3310'), 10);
    this.clamscan = await new NodeClam().init({
      clamdscan: {
        host: process.env.CLAMAV_HOST || 'localhost',
        port: Number.isFinite(clamPort) ? clamPort : 3310,
        active: true,
      },
      preference: 'clamdscan'
    });
  }

  async processAttachment(mediaUrl: string, metaToken: string): Promise<any> {
    // 1. Descargar como Stream en lugar de Buffer
    const response = await axios.get(mediaUrl, {
      responseType: 'stream', 
      headers: { Authorization: `Bearer ${metaToken}` },
    });

    // Archivo temporal mientras se descarga y valida
    const tempFileName = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}.tmp`;
    const tempFilePath = path.join(UPLOADS_DIR, tempFileName);
    const writer = createWriteStream(tempFilePath);

    let typeInfo: { mime: string; ext: string } | null = null;
    let isFirstChunk = true;

    return new Promise((resolve, reject) => {
      // 2. Interceptar los fragmentos (chunks) de datos
      response.data.on('data', (chunk: Buffer) => {
        if (isFirstChunk) {
          isFirstChunk = false;
          // Validar magic bytes solo con el primer fragmento
          typeInfo = this.detectMimeType(chunk);
          
          if (!typeInfo) {
            response.data.destroy(); // Abortar conexión con Meta
            writer.end();
            return reject(new BadRequestException(`MIME type no soportado o archivo corrupto.`));
          }
        }
      });

      // Canalizar el stream de descarga directo al archivo en disco
      response.data.pipe(writer);

      writer.on('finish', async () => {
        // Si falló la validación inicial, limpiamos la basura
        if (!typeInfo) {
          await fsPromises.unlink(tempFilePath).catch(() => {});
          return;
        }

        // 3. Renombrar con la extensión correcta descubierta
        const finalFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${typeInfo.ext}`;
        const finalFilePath = path.join(UPLOADS_DIR, finalFileName);
        await fsPromises.rename(tempFilePath, finalFilePath);

        this.logger.log(`Archivo guardado localmente vía Stream: ${finalFilePath}`);

        // 4. Escaneo Antivirus (El archivo ya está en disco, no en RAM)
        try {
          const { isInfected, viruses } = await this.clamscan.isInfected(finalFilePath);
          if (isInfected) {
            await fsPromises.unlink(finalFilePath);
            this.logger.warn(`Malware detectado y eliminado: ${viruses.join(', ')}`);
            return reject(new BadRequestException('El archivo contiene malware.'));
          }

          // Resolver con la metadata lista para el mensaje enriquecido
          resolve({
            file_id: finalFileName,
            url: `${process.env.APP_BASE_URL}/uploads/attachments/${finalFileName}`,
            type: typeInfo.mime,
            path: finalFilePath,
          });
        } catch (error) {
          await fsPromises.unlink(finalFilePath).catch(() => {});
          reject(new InternalServerErrorException('Error al escanear el archivo.'));
        }
      });

      writer.on('error', () => {
        reject(new InternalServerErrorException('Error escribiendo el archivo en el servidor.'));
      });
    });
  }
}