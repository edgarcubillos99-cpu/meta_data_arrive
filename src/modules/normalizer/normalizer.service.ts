import { Injectable, Logger } from '@nestjs/common';
import { NormalizedMessageDto } from '../../common/dtos/normalized-message.dto';

@Injectable()
export class NormalizerService {
  private readonly logger = new Logger(NormalizerService.name);

  async normalizeMetaPayload(payload: any, channel: 'whatsapp' | 'messenger'): Promise<NormalizedMessageDto[]> {
    const messages: NormalizedMessageDto[] = [];

    if (channel === 'whatsapp' && payload.entry) {
      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          const msgData = change.value.messages?.[0];
          if (!msgData) continue;

          messages.push({
            user_id: msgData.from, // Número de teléfono
            channel: 'whatsapp',
            text: msgData.text?.body || '',
            attachments: this.extractWhatsAppMedia(msgData),
            timestamp: msgData.timestamp,
          });
        }
      }
    }
    // Lógica similar para Messenger/IG...
    return messages;
  }

  private extractWhatsAppMedia(msgData: any) {
    // Si tiene imagen, documento, etc., extraemos el ID para que el media-handler lo descargue luego
    if (msgData.image) return [{ file_id: msgData.image.id, url: '', type: msgData.image.mime_type }];
    return [];
  }
}