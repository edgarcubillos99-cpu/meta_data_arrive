import { Controller, Get, Post, Body, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { NormalizerService } from '../normalizer/normalizer.service';
import { RabbitPublisherService } from '../rabbitmq/rabbit-publisher.service';

@Controller('webhooks/meta')
export class WebhookController {
  constructor(
    private readonly normalizer: NormalizerService,
    private readonly publisher: RabbitPublisherService,
  ) {}

  @Get()
  verifyWebhook(@Query('hub.mode') mode: string, @Query('hub.verify_token') token: string, @Query('hub.challenge') challenge: string) {
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      return challenge;
    }
    throw new UnauthorizedException();
  }

  @Post()
  async handleIncomingMessage(@Headers('x-hub-signature-256') signature: string, @Body() payload: any) {
    // 1. Validar firma de Meta (Omitido por brevedad, usar crypto.createHmac)
    
    // 2. Normalizar
    const normalizedMessages = await this.normalizer.normalizeMetaPayload(payload);
    
    // 3. Enviar a RabbitMQ (El manejo de media se hará asíncronamente o antes de encolar)
    for (const msg of normalizedMessages) {
      await this.publisher.publishIncomingMessage(msg);
    }
    
    return 'EVENT_RECEIVED'; // Meta requiere un 200 OK rápido
  }
}