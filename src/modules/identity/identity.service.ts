import { Injectable } from '@nestjs/common';
import { RedisStateService } from '../../modules/identity/redis-state.service';

@Injectable()
export class IdentityService {
  constructor(private readonly redis: RedisStateService) {}

  async checkPendingConfirmation(userId: string, incomingText: string): Promise<boolean> {
    const pendingData = await this.redis.get(`pending_auth:${userId}`);
    if (!pendingData) return false; // No estaba esperando confirmación

    const text = incomingText.trim().toUpperCase();
    if (text === 'SI' || text === 'CONFIRMAR') {
      // Usuario confirma: Modificar el payload guardado y liberarlo
      pendingData.cliente.is_verified = true;
      await this.redis.delete(`pending_auth:${userId}`);
      // Aquí retornaríamos los datos para que sean encolados en enriched_messages
      return true; 
    } 
    
    if (text === 'NO' || text === 'RECHAZAR') {
      // Desvincular cliente
      pendingData.cliente = null;
      await this.redis.delete(`pending_auth:${userId}`);
      return true;
    }

    return true; // Sigue atrapado en el flujo hasta que diga SI o NO
  }

  async askForConfirmation(userId: string, channel: string, clientData: any): Promise<boolean> {
    const existing = await this.redis.get(`pending_auth:${userId}`);
    if (existing) return true;

    await this.redis.set(`pending_auth:${userId}`, { userId, channel, cliente: clientData });
    return true;
  }

  async savePendingMessageContext(userId: string, message: any): Promise<void> {
    await this.redis.set(`pending_msg:${userId}`, message);
  }

  /** Evita reenviar la pregunta de servicio en cada mensaje (TTL 7 días). Incluye canal para no mezclar WhatsApp / Messenger / Instagram. */
  async wasServiceInquirySent(channel: string, userId: string): Promise<boolean> {
    return !!(await this.redis.get(`service_inquiry_sent:${channel}:${userId}`));
  }

  async markServiceInquirySent(channel: string, userId: string): Promise<void> {
    const sevenDays = 7 * 24 * 60 * 60;
    await this.redis.set(`service_inquiry_sent:${channel}:${userId}`, true, sevenDays);
  }
}