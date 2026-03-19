import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisStateService {
  private mockRedis = new Map<string, any>(); // Simulador temporal

  async get(key: string): Promise<any> {
    return this.mockRedis.get(key);
  }

  /** ttlSeconds: tiempo de vida en segundos (opcional; el mock borra la clave al expirar). */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    this.mockRedis.set(key, value);
    if (ttlSeconds && ttlSeconds > 0) {
      setTimeout(() => this.mockRedis.delete(key), ttlSeconds * 1000);
    }
  }

  async delete(key: string): Promise<void> {
    this.mockRedis.delete(key);
  }
}