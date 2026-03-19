import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisStateService {
  private mockRedis = new Map<string, any>(); // Simulador temporal

  async get(key: string): Promise<any> {
    return this.mockRedis.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.mockRedis.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.mockRedis.delete(key);
  }
}