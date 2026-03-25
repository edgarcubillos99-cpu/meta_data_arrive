import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { NormalizedMessageDto } from '../../common/dtos/normalized-message.dto';

@Injectable()
export class RabbitPublisherService {
  private readonly logger = new Logger(RabbitPublisherService.name);

  constructor(private readonly amqp: AmqpConnection) {}

  async publishIncomingMessage(message: NormalizedMessageDto) {
    const routingKey = `message.incoming.${message.channel}`;
    const queueName = `incoming_${message.channel}`;

    await this.amqp.publish(
      'telecom_exchange',
      routingKey,
      message,
      { persistent: true },
    );

    const preview =
      message.text?.trim().slice(0, 120) ||
      (message.attachments?.length ? `[${message.attachments.length} adjunto(s)]` : '') ||
      (message.location ? `[ubicación]` : '') ||
      '(sin texto)';

    this.logger.log(
      `RabbitMQ: mensaje encolado → cola "${queueName}" (exchange=telecom_exchange, rk=${routingKey}) user_id=${message.user_id} preview="${preview}"`,
    );
  }
}