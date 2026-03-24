import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe, AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ServiceInquiryService } from '../../modules/meta-outbound/service-inquiry.service';

@Injectable()
export class EnrichmentConsumer {
  private readonly logger = new Logger(EnrichmentConsumer.name);

  constructor(
    private readonly serviceInquiry: ServiceInquiryService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  // --- CONSUMIDORES POR CANAL ---

  @RabbitSubscribe({
    exchange: 'telecom_exchange',
    routingKey: 'message.incoming.whatsapp',
    queue: 'incoming_whatsapp',
    queueOptions: {
      deadLetterExchange: 'telecom_dlx',
      deadLetterRoutingKey: 'message.incoming.whatsapp.dlq',
    },
  })
  async handleWhatsAppMessage(msg: any) {
    this.logger.log(`📥 [WhatsApp] Recibido mensaje de: ${msg.user_id}`);
    await this.processMessage(msg);
  }

  @RabbitSubscribe({
    exchange: 'telecom_exchange',
    routingKey: 'message.incoming.messenger',
    queue: 'incoming_messenger',
    queueOptions: {
      deadLetterExchange: 'telecom_dlx',
      deadLetterRoutingKey: 'message.incoming.messenger.dlq',
    },
  })
  async handleMessengerMessage(msg: any) {
    this.logger.log(`📥 [Messenger] Recibido mensaje de: ${msg.user_id}`);
    await this.processMessage(msg);
  }

  @RabbitSubscribe({
    exchange: 'telecom_exchange',
    routingKey: 'message.incoming.instagram',
    queue: 'incoming_instagram',
    queueOptions: {
      deadLetterExchange: 'telecom_dlx',
      deadLetterRoutingKey: 'message.incoming.instagram.dlq',
    },
  })
  async handleInstagramMessage(msg: any) {
    this.logger.log(`📥 [Instagram] Recibido mensaje de: ${msg.user_id}`);
    await this.processMessage(msg);
  }

  // --- LÓGICA CENTRAL DE PROCESAMIENTO ---

  private async processMessage(msg: any) {
    try {
      await this.serviceInquiry.sendPreEnrichmentInquiryIfNeeded(msg);

      const enrichedMessage = this.buildEnrichedMessage(msg);

      await this.amqpConnection.publish('telecom_exchange', 'message.enriched', enrichedMessage);

    } catch (error) {
      this.logger.error(`Error procesando mensaje de ${msg.channel}: ${error.message}`);
      // Al lanzar error, nestjs-rabbitmq lo enviará a la DLQ correspondiente automáticamente
      throw error; 
    }
  }

  private buildEnrichedMessage(msg: any) {
    return {
      user_id: msg.user_id,
      channel: msg.channel,
      message: msg.text,
      attachments: msg.attachments || [],
      cliente: null,
      metadata: { timestamp: new Date().toISOString() },
    };
  }
}