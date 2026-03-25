import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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

  constructor(private readonly config: ConfigService) {}

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
        return await this.normalizeWhatsApp(payload);
      case 'page':
        return this.normalizePageMessaging(payload, 'messenger');
      case 'instagram':
        return this.normalizePageMessaging(payload, 'instagram');
      default:
        this.logger.warn(`Tipo de webhook Meta no soportado: ${objectType}`);
        return [];
    }
  }

  private async normalizeWhatsApp(payload: any): Promise<NormalizedMessageDto[]> {
    const messages: NormalizedMessageDto[] = [];

    if (!payload.entry) return messages;

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const msgData = change.value?.messages?.[0];
        if (!msgData) continue;

        const ts = this.parseTimestamp(msgData.timestamp);
        const location = this.extractWhatsAppLocation(msgData);
        const attachments = await this.extractWhatsAppMedia(msgData);

        messages.push({
          user_id: String(msgData.from),
          channel: 'whatsapp',
          text: this.extractWhatsAppText(msgData),
          attachments,
          ...(location ? { location } : {}),
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

  /**
   * Texto del mensaje: cuerpo de `type: text`, o pie de foto/archivo (`caption`) en imagen, vídeo o documento.
   * WhatsApp no rellena `text.body` cuando el usuario envía solo media con leyenda.
   */
  private extractWhatsAppText(msgData: any): string {
    const body = msgData.text?.body;
    if (typeof body === 'string' && body.trim()) return body.trim();

    const caption =
      msgData.image?.caption ??
      msgData.video?.caption ??
      msgData.document?.caption;
    if (typeof caption === 'string' && caption.trim()) return caption.trim();

    return '';
  }

  /**
   * WhatsApp envía `location` con lat/lng; no va en `attachments`.
   * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
   */
  private extractWhatsAppLocation(msgData: any): NormalizedMessageDto['location'] {
    const loc = msgData.location;
    if (!loc) return undefined;
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    return {
      latitude: lat,
      longitude: lng,
      name: typeof loc.name === 'string' && loc.name.trim() ? loc.name.trim() : undefined,
      address: typeof loc.address === 'string' && loc.address.trim() ? loc.address.trim() : undefined,
    };
  }

  /**
   * El webhook solo incluye el id del medio; la URL temporal se obtiene con Graph API (requiere WHATSAPP_GRAPH_API_TOKEN).
   */
  private async resolveWhatsAppMediaUrl(mediaId: string): Promise<string | undefined> {
    const token = this.config.get<string>('WHATSAPP_GRAPH_API_TOKEN')?.trim();
    if (!token) return undefined;
    const version = this.config.get<string>('WHATSAPP_GRAPH_API_VERSION')?.trim() || 'v21.0';
    try {
      const { data } = await axios.get<{ url?: string }>(
        `https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000,
        },
      );
      return typeof data.url === 'string' ? data.url : undefined;
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const ax = err;
        const status = ax.response?.status;
        if (status === 401) {
          this.logger.warn(
            `Graph API 401 al obtener medio WhatsApp (${mediaId}): WHATSAPP_GRAPH_API_TOKEN inválido, expirado o sin permisos para WhatsApp. Usa el token de "API setup" de la app (WhatsApp > API setup), no el App Secret ni un token de página de Facebook.`,
          );
          return undefined;
        }
        const metaMsg = ax.response?.data?.error?.message;
        this.logger.warn(
          `No se pudo resolver URL de medio WhatsApp (${mediaId}): HTTP ${status ?? '?'}` +
            (metaMsg ? ` — ${metaMsg}` : ` — ${ax.message}`),
        );
        return undefined;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`No se pudo resolver URL de medio WhatsApp (${mediaId}): ${msg}`);
      return undefined;
    }
  }

  private async extractWhatsAppMedia(msgData: any): Promise<NormalizedMessageDto['attachments']> {
    if (msgData.image) {
      const id = msgData.image.id;
      const url = (await this.resolveWhatsAppMediaUrl(id)) ?? '';
      return [{ file_id: id, url, type: msgData.image.mime_type ?? 'image' }];
    }
    if (msgData.document) {
      const id = msgData.document.id;
      const url = (await this.resolveWhatsAppMediaUrl(id)) ?? '';
      return [
        {
          file_id: id,
          url,
          type: msgData.document.mime_type ?? 'application/octet-stream',
        },
      ];
    }
    if (msgData.audio) {
      const id = msgData.audio.id;
      const url = (await this.resolveWhatsAppMediaUrl(id)) ?? '';
      return [{ file_id: id, url, type: msgData.audio.mime_type ?? 'audio' }];
    }
    if (msgData.video) {
      const id = msgData.video.id;
      const url = (await this.resolveWhatsAppMediaUrl(id)) ?? '';
      return [{ file_id: id, url, type: msgData.video.mime_type ?? 'video' }];
    }
    if (msgData.sticker) {
      const id = msgData.sticker.id;
      const url = (await this.resolveWhatsAppMediaUrl(id)) ?? '';
      return [{ file_id: id, url, type: msgData.sticker.mime_type ?? 'image/webp' }];
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
