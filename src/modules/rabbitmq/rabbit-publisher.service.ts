import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { NormalizedMessageDto } from '../../common/dtos/normalized-message.dto';

@Injectable()
export class RabbitPublisherService {
  constructor(private readonly amqp: AmqpConnection) {}

  async publishIncomingMessage(message: NormalizedMessageDto) {
    // Generamos una routing key dinámica basada en el canal:
    // Ej: 'message.incoming.whatsapp', 'message.incoming.messenger', etc.
    const routingKey = `message.incoming.${message.channel}`;
    
    await this.amqp.publish(
      'telecom_exchange', 
      routingKey, 
      message,
      { persistent: true } // Garantiza que no se pierdan si Rabbit se reinicia
    );
  }

  async publishEnrichedMessage(message: any) {
    await this.amqp.publish('telecom_exchange', 'message.enriched', message, { persistent: true });
  }
}