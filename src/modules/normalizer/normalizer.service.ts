import { Injectable, Logger } from '@nestjs/common';
import { NormalizedMessageDto } from '../../common/dtos/normalized-message.dto';
import type { MetaMessagingChannel } from '../../common/types/meta-messaging.types';

/**
 * Convierte webhooks de Meta (WhatsApp Business, Page/Messenger, Instagram) a mensajes internos.
 * @see https://developers.facebook.com/docs/graph-api/webhooks/reference/whatsapp_business_account
 * @see https://developers.facebook.com/docs/messenger-platform/webhook
 */
@Injectable()
export class NormalizerService {
  private readonly logger = new Logger(NormalizerService.name);

  /**
   * Detecta `payload.object` y normaliza sin pasar el canal manualmente desde el controller.
   */
  async normalizeMetaPayload(payload: any): Promise<NormalizedMessageDto[]> {
    const objectType = payload?.object as string | undefined;

    if (!objectType) {
      this.logger.warn('Webhook Meta sin campo object');
      return [];
    }

    switch (objectType) {
      case 'whatsapp_business_account':
        return this.normalizeWhatsApp(payload);
      case 'page':
        return this.normalizePageMessaging(payload, 'messenger');
      case 'instagram':
        return this.normalizePageMessaging(payload, 'instagram');
      default:
        this.logger.warn(`Tipo de webhook Meta no soportado: ${objectType}`);
        return [];
    }
  }

  private normalizeWhatsApp(payload: any): NormalizedMessageDto[] {
    const messages: NormalizedMessageDto[] = [];

    if (!payload.entry) return messages;

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const msgData = change.value?.messages?.[0];
        if (!msgData) continue;

        const ts = this.parseTimestamp(msgData.timestamp);

        messages.push({
          user_id: String(msgData.from),
          channel: 'whatsapp',
          text: msgData.text?.body ?? '',
          attachments: this.extractWhatsAppMedia(msgData),
          timestamp: ts,
        });
      }
    }

    return messages;
  }

  /**
   * Messenger (`object: page`) e Instagram Direct (`object: instagram`) comparten forma `entry[].messaging[]`.
   */
  private normalizePageMessaging(
    payload: any,
    channel: Extract<MetaMessagingChannel, 'messenger' | 'instagram'>,
  ): NormalizedMessageDto[] {
    const out: NormalizedMessageDto[] = [];

    for (const entry of payload.entry || []) {
      for (const event of entry.messaging || []) {
        if (!event?.message) continue;
        if (event.message.is_echo) continue;

        const text = event.message.text ?? '';
        const attachments = this.extractPageAttachments(event.message);

        out.push({
          user_id: String(event.sender?.id ?? ''),
          channel,
          text,
          attachments,
          timestamp: this.normalizeMessagingTimestamp(event.timestamp),
        });
      }
    }

    return out;
  }

  private extractPageAttachments(message: any): NormalizedMessageDto['attachments'] {
    const list = message.attachments;
    if (!Array.isArray(list) || list.length === 0) return [];

    return list.map((att: any, i: number) => ({
      file_id: message.mid ? `${message.mid}_${i}` : `att_${i}`,
      url: att.payload?.url ?? '',
      type: att.type ?? 'unknown',
    }));
  }

  private extractWhatsAppMedia(msgData: any): NormalizedMessageDto['attachments'] {
    if (msgData.image) {
      return [{ file_id: msgData.image.id, url: '', type: msgData.image.mime_type ?? 'image' }];
    }
    if (msgData.document) {
      return [
        {
          file_id: msgData.document.id,
          url: '',
          type: msgData.document.mime_type ?? 'application/octet-stream',
        },
      ];
    }
    if (msgData.audio) {
      return [{ file_id: msgData.audio.id, url: '', type: msgData.audio.mime_type ?? 'audio' }];
    }
    if (msgData.video) {
      return [{ file_id: msgData.video.id, url: '', type: msgData.video.mime_type ?? 'video' }];
    }
    return [];
  }

  /** WhatsApp envía timestamp en segundos (string o number). */
  private parseTimestamp(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return Math.floor(Date.now() / 1000);
    return n < 1e12 ? n : Math.floor(n / 1000);
  }

  /** Messenger/Instagram suelen usar ms desde epoch en el webhook. */
  private normalizeMessagingTimestamp(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return Math.floor(Date.now() / 1000);
    return n > 1e12 ? Math.floor(n / 1000) : n;
  }
}
