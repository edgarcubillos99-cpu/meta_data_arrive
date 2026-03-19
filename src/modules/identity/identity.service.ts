import { Injectable } from '@nestjs/common';
import { RedisStateService } from './redis-state.service';
// ... imports

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
}