import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';

const ALLOWED_MIME_SIGNATURES: Record<string, { mime: string; ext: string }> = {
  'ffd8ff': { mime: 'image/jpeg', ext: 'jpg' },
  '89504e47': { mime: 'image/png', ext: 'png' },
  '25504446': { mime: 'application/pdf', ext: 'pdf' },
  '4f676753': { mime: 'audio/ogg', ext: 'ogg' },
};

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'attachments');

@Injectable()
export class MediaService {
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

    const baseUrl = process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

    return {
      file_id: fileName,
      url: `${baseUrl}/uploads/attachments/${fileName}`,
      type: typeInfo.mime,
      path: filePath,
    };
  }
}