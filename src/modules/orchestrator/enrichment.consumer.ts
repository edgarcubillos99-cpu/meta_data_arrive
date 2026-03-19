import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe, AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { UbersmithService } from '../../modules/ubersmith/ubersmith.service';
import { IdentityService } from '../../modules/identity/identity.service';
import { ServiceInquiryService } from '../../modules/meta-outbound/service-inquiry.service';

@Injectable()
export class EnrichmentConsumer {
  private readonly logger = new Logger(EnrichmentConsumer.name);

  constructor(
    private readonly ubersmith: UbersmithService,
    private readonly identity: IdentityService,
    private readonly serviceInquiry: ServiceInquiryService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @RabbitSubscribe({
    exchange: 'telecom_exchange',
    routingKey: 'message.incoming',
    queue: 'incoming_messages',
    queueOptions: {
      deadLetterExchange: 'telecom_dlx',
      deadLetterRoutingKey: 'message.incoming.dlq',
    },
  })
  async handleIncomingMessage(msg: any) {
    try {
      this.logger.log(`Procesando mensaje del usuario: ${msg.user_id}`);

      // 0. Pregunta previa (cliente actual vs potencial) antes de enriquecer con CRM
      await this.serviceInquiry.sendPreEnrichmentInquiryIfNeeded(msg);

      // 1. CRM: búsqueda por teléfono solo aplica a WhatsApp (E.164). Messenger/Instagram usan IDs distintos.
      const clientData =
        msg.channel === 'whatsapp'
          ? await this.ubersmith.findClientByPhone(msg.user_id)
          : null;

      if (clientData) {
        // 2. Iniciar flujo de confirmación determinística
        const confirmationPending = await this.identity.askForConfirmation(msg.user_id, msg.channel, clientData);
        
        if (confirmationPending) {
           // Guardamos el mensaje original en cache/Redis esperando respuesta del usuario
           await this.identity.savePendingMessageContext(msg.user_id, msg);
           return; // El flujo se pausa aquí hasta que el usuario responda "SI/NO"
        }
      }

      // 3. Si no hay cliente o ya está confirmado por cache, empaquetar
      const enrichedMessage = this.buildEnrichedMessage(msg, clientData);

      // 4. Publicar en cola final para LLM
      await this.amqpConnection.publish('telecom_exchange', 'message.enriched', enrichedMessage);

    } catch (error) {
      this.logger.error(`Error procesando mensaje: ${error.message}`);
      // Al lanzar error, nestjs-rabbitmq lo enviará a la DLQ automáticamente tras N reintentos
      throw error; 
    }
  }

  private buildEnrichedMessage(msg: any, clientData: any) {
     return {
        user_id: msg.user_id,
        channel: msg.channel,
        message: msg.text,
        attachments: msg.attachments || [],
        cliente: clientData ? {
          clientid: clientData.id,
          nombre: clientData.name,
          servicio: clientData.service_plan,
          email: clientData.email,
          telefono: clientData.phone
        } : null,
        metadata: { timestamp: new Date().toISOString() }
      };
  }
}