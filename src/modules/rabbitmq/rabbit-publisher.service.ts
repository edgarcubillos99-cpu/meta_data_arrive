import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { NormalizedMessageDto } from '../../common/dtos/normalized-message.dto';

@Injectable()
export class RabbitPublisherService {
  constructor(private readonly amqp: AmqpConnection) {}

  async publishIncomingMessage(message: NormalizedMessageDto) {
    await this.amqp.publish(
      'telecom_exchange', 
      'message.incoming', 
      message,
      { persistent: true } // Garantiza que no se pierdan si Rabbit se reinicia
    );
  }

  async publishEnrichedMessage(message: any) {
    await this.amqp.publish('telecom_exchange', 'message.enriched', message, { persistent: true });
  }
}