import { Controller, Get, Post, Body, Query, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { NormalizerService } from '../../modules/normalizer/normalizer.service';
import { RabbitPublisherService } from '../../modules/rabbitmq/rabbit-publisher.service';
import { MediaService } from '../../modules/media-handler/media.service';

@Controller('webhooks/meta')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly normalizer: NormalizerService,
    private readonly publisher: RabbitPublisherService,
    private readonly mediaService: MediaService, // <-- INYECTAR MEDIASERVICE
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string, 
    @Query('hub.verify_token') token: string, 
    @Query('hub.challenge') challenge: string
  ) {
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      this.logger.log('✅ Verificación de webhook exitosa.');
      return challenge;
    }
    throw new UnauthorizedException();
  }

  @Post()
  handleIncomingMessage(@Headers('x-hub-signature-256') signature: string, @Body() payload: any) {
    // 1. Validar firma de Meta (crypto.createHmac) aquí...

    // 2. Procesar en segundo plano para no bloquear el "200 OK" rápido que exige Meta
    this.processPayloadAsync(payload).catch((err) => {
      this.logger.error('Error no controlado procesando el payload:', err);
    });
    
    // 3. Responder INMEDIATAMENTE a Meta
    return 'EVENT_RECEIVED'; 
  }

  /**
   * Procesa la normalización, descarga segura de archivos y encolado en background.
   */
  private async processPayloadAsync(payload: any) {
    const normalizedMessages = await this.normalizer.normalizeMetaPayload(payload);
    
    for (const msg of normalizedMessages) {
      
      // Si el mensaje tiene adjuntos (URL temporal de Meta), los descargamos y escaneamos
      if (msg.attachments && msg.attachments.length > 0) {
        for (let i = 0; i < msg.attachments.length; i++) {
          const att = msg.attachments[i];
          
          if (att.url) {
            // Identificar qué token usar según el canal
            const token = (msg.channel === 'whatsapp' 
              ? process.env.WHATSAPP_GRAPH_API_TOKEN 
              : process.env.META_PAGE_ACCESS_TOKEN) ?? '';

            try {
              this.logger.log(`Descargando y escaneando archivo: ${att.file_id}`);
              const safeMedia = await this.mediaService.processAttachment(att.url, token);
              
              // Sobrescribir el adjunto con los datos seguros y locales
              msg.attachments[i] = {
                file_id: safeMedia.file_id,
                url: safeMedia.url,     // URL local de tu servidor
                type: safeMedia.type    // MIME validado por Magic Bytes
              };
            } catch (error) {
              this.logger.error(`Media descartada por seguridad o error: ${error.message}`);
              msg.attachments[i].url = 'BLOCKED_BY_SECURITY';
            }
          }
        }
      }
      
      // Enviar a RabbitMQ con la metadata local ya lista para el LLM
      await this.publisher.publishIncomingMessage(msg);
    }
  }
}