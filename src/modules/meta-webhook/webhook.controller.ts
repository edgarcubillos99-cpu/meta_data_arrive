import { Controller, Get, Post, Body, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { NormalizerService } from '../../modules/normalizer/normalizer.service';
import { RabbitPublisherService } from '../../modules/rabbitmq/rabbit-publisher.service';

@Controller('webhooks/meta')
export class WebhookController {
  constructor(
    private readonly normalizer: NormalizerService,
    private readonly publisher: RabbitPublisherService,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string, 
    @Query('hub.verify_token') token: string, 
    @Query('hub.challenge') challenge: string
  ) {
    // LOG DE DEPURACIÓN
    console.log('--- WEBHOOK VERIFICATION REQUEST ---');
    console.log('Mode:', mode);
    console.log('Token recibido de Meta:', token);
    console.log('Token en mi .env local:', process.env.META_VERIFY_TOKEN);
    console.log('Challenge:', challenge);

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      console.log('✅ Verificación exitosa. Retornando challenge.');
      return challenge;
    }
    
    console.error('❌ Falló la verificación. Retornando 401 Unauthorized.');
    throw new UnauthorizedException();
  }

  @Post()
  async handleIncomingMessage(@Headers('x-hub-signature-256') signature: string, @Body() payload: any) {
    // 1. Validar firma de Meta (Omitido por brevedad, usar crypto.createHmac)
    
    // 2. Normalizar (WhatsApp Business, Messenger u Instagram según payload.object)
    const normalizedMessages = await this.normalizer.normalizeMetaPayload(payload);
    
    // 3. Enviar a RabbitMQ (El manejo de media se hará asíncronamente o antes de encolar)
    for (const msg of normalizedMessages) {
      await this.publisher.publishIncomingMessage(msg);
    }
    
    return 'EVENT_RECEIVED'; // Meta requiere un 200 OK rápido
  }
}