import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';
import * as NodeClam from 'clamscan';
import * as fileType from 'file-type';
import axios from 'axios';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private clamscan: any;
  private blobClient: BlobServiceClient;

  constructor() {
    this.initClamAv();
    this.blobClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  }

  private async initClamAv() {
    this.clamscan = await new NodeClam().init({
      clamdscan: { host: process.env.CLAMAV_HOST, port: 3310 }
    });
  }

  async processAttachment(mediaUrl: string, metaToken: string): Promise<any> {
    // 1. Descargar archivo en buffer
    const response = await axios.get(mediaUrl, { 
      responseType: 'arraybuffer',
      headers: { Authorization: `Bearer ${metaToken}` } 
    });
    const buffer = Buffer.from(response.data);

    // 2. Validar MIME Type
    const typeInfo = await fileType.fromBuffer(buffer);
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'audio/ogg'];
    if (!typeInfo || !allowedTypes.includes(typeInfo.mime)) {
      throw new BadRequestException(`MIME type no soportado: ${typeInfo?.mime}`);
    }

    // 3. Escaneo Antivirus (ClamAV)
    const { isInfected } = await this.clamscan.scanBuffer(buffer);
    if (isInfected) {
      this.logger.warn(`Archivo malicioso detectado y bloqueado.`);
      throw new BadRequestException('El archivo no pasó las políticas de seguridad.');
    }

    // 4. Subir a Azure Blob Storage
    const containerClient = this.blobClient.getContainerClient('attachments');
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${typeInfo.ext}`;
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    await blockBlobClient.uploadData(buffer);

    // 5. Retornar Metadata
    return {
      file_id: fileName,
      url: blockBlobClient.url,
      type: typeInfo.mime,
      safe: true,
    };
  }
}