import type { MetaMessagingChannel } from '../types/meta-messaging.types';

export class AttachmentDto {
  file_id: string;
  url: string;
  type: string; // MIME o tipo genérico
}

/**
 * Mensaje unificado para colas internas.
 * - WhatsApp: `user_id` = número E.164 sin + (campo `from` del webhook).
 * - Messenger: `user_id` = PSID del remitente.
 * - Instagram: `user_id` = IGSID (Instagram-scoped id del remitente).
 */
export class NormalizedMessageDto {
  user_id: string;
  channel: MetaMessagingChannel;
  text: string;
  attachments: AttachmentDto[];
  /** Unix segundos o ms según origen; se normaliza lo posible */
  timestamp: number;
}
