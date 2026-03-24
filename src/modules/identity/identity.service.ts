import { Injectable } from '@nestjs/common';
import { MemoryStateService } from './memory-state.service';

@Injectable()
export class IdentityService {
  constructor(private readonly memory: MemoryStateService) {}

  /** Evita reenviar la pregunta de servicio en cada mensaje (TTL 7 días). Incluye canal para no mezclar WhatsApp / Messenger / Instagram. */
  async wasServiceInquirySent(channel: string, userId: string): Promise<boolean> {
    return !!(await this.memory.get(`service_inquiry_sent:${channel}:${userId}`));
  }

  async markServiceInquirySent(channel: string, userId: string): Promise<void> {
    const sevenDays = 7 * 24 * 60 * 60;
    await this.memory.set(`service_inquiry_sent:${channel}:${userId}`, true, sevenDays);
  }
}