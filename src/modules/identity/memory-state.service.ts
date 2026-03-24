import { Injectable } from '@nestjs/common';

/**
 * Estado en memoria del proceso (una sola instancia). Sirve para no reenviar la pregunta
 * de servicios contratados en cada mensaje cuando SERVICE_INQUIRY_SEND_ONCE está activo.
 */
@Injectable()
export class MemoryStateService {
  private readonly store = new Map<string, any>();
  private readonly ttlTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async get(key: string): Promise<any> {
    return this.store.get(key);
  }

  /** ttlSeconds: tiempo de vida en segundos (opcional). */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const prev = this.ttlTimers.get(key);
    if (prev) clearTimeout(prev);
    this.ttlTimers.delete(key);

    this.store.set(key, value);
    if (ttlSeconds && ttlSeconds > 0) {
      const t = setTimeout(() => {
        this.store.delete(key);
        this.ttlTimers.delete(key);
      }, ttlSeconds * 1000);
      this.ttlTimers.set(key, t);
    }
  }

  async delete(key: string): Promise<void> {
    const prev = this.ttlTimers.get(key);
    if (prev) clearTimeout(prev);
    this.ttlTimers.delete(key);
    this.store.delete(key);
  }
}
