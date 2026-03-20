import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as NodeClam from 'clamscan';

const ALLOWED_MIME_SIGNATURES: Record<string, { mime: string; ext: string }> = {
  'ffd8ff': { mime: 'image/jpeg', ext: 'jpg' },
  '89504e47': { mime: 'image/png', ext: 'png' },
  '25504446': { mime: 'application/pdf', ext: 'pdf' },
  '4f676753': { mime: 'audio/ogg', ext: 'ogg' },
  'd0cf11e0': { mime: 'application/msword', ext: 'doc' },
  '504b0304': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
};

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'attachments');

@Injectable()
export class MediaService {
  private clamscan: NodeClam.Clamscan;
  private readonly logger = new Logger(MediaService.name);

  constructor() {
    this.ensureUploadsDir();
  }

  private async ensureUploadsDir(): Promise<void> {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  }

  private detectMimeType(buffer: Buffer): { mime: string; ext: string } | null {
    const hex = buffer.subarray(0, 4).toString('hex');
    for (const [signature, typeInfo] of Object.entries(ALLOWED_MIME_SIGNATURES)) {
      if (hex.startsWith(signature)) return typeInfo;
    }
    return null;
  }

  async onModuleInit() {
    this.clamscan = await new NodeClam().init({
      clamdscan: {
        host: process.env.CLAMAV_HOST || 'localhost',
        port: process.env.CLAMAV_PORT || 3310,
        active: true,
      },
      preference: 'clamdscan'
    });
  }

  async processAttachment(mediaUrl: string, metaToken: string): Promise<any> {
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${metaToken}` },
    });
    const buffer = Buffer.from(response.data);

    const typeInfo = this.detectMimeType(buffer);
    if (!typeInfo) {
      throw new BadRequestException(`MIME type no soportado o no reconocido.`);
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${typeInfo.ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    await fs.writeFile(filePath, buffer);

    this.logger.log(`Archivo guardado localmente: ${filePath}`);

    // 2. Escaneo Antivirus
    try {
      const { isInfected, viruses } = await this.clamscan.isInfected(filePath);
      if (isInfected) {
        await fs.unlink(filePath); // Eliminar archivo peligroso
        this.logger.warn(`Archivo infectado detectado y eliminado: ${viruses.join(', ')}`);
        throw new BadRequestException('El archivo contiene malware.');
      }
    } catch (error) {
      await fs.unlink(filePath).catch(() => {});
      throw new InternalServerErrorException('Error al escanear el archivo.');
    }

    return {
      file_id: fileName,
      url: `${process.env.APP_BASE_URL}/uploads/attachments/${fileName}`,
      type: typeInfo.mime,
      path: filePath,
    };
  }
}