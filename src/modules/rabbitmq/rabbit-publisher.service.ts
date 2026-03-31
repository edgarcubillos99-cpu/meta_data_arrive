import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { NormalizedMessageDto } from '../../common/dtos/normalized-message.dto';

@Injectable()
export class RabbitPublisherService implements OnModuleInit {
  private readonly logger = new Logger(RabbitPublisherService.name);

  constructor(private readonly amqp: AmqpConnection) {}

  /**
   * Se ejecuta al iniciar la aplicación. Crea las colas y sus colas de cuarentena (DLQ)
   */
  async onModuleInit() {
    const channel = this.amqp.channel;
    const metaChannels = ['whatsapp', 'messenger', 'instagram'];

    try {
      // 1. Declarar Exchanges (Principal y Dead-Letter)
      await channel.assertExchange('telecom_exchange', 'topic', { durable: true });
      await channel.assertExchange('telecom_dlx_exchange', 'direct', { durable: true });

      // 2. Iterar sobre los canales y crear topología para cada uno
      for (const ch of metaChannels) {
        const mainQueue = `incoming_${ch}`;
        const dlqName = `dlq_incoming_${ch}`;
        const dlqRoutingKey = `dlq_${ch}_routing_key`;

        // A. Crear la Dead-Letter Queue y enlazarla a su Exchange
        await channel.assertQueue(dlqName, { durable: true });
        await channel.bindQueue(dlqName, 'telecom_dlx_exchange', dlqRoutingKey);

        // B. Crear la Cola Principal y configurarle su DLQ respectiva
        await channel.assertQueue(mainQueue, {
          durable: true,
          deadLetterExchange: 'telecom_dlx_exchange',
          deadLetterRoutingKey: dlqRoutingKey, // Si un msj falla acá, se va al DLX con este routing key
        });

        // C. Enlazar la Cola Principal al Exchange Principal
        await channel.bindQueue(mainQueue, 'telecom_exchange', `message.incoming.${ch}`);
      }

      this.logger.log('✅ Topología RabbitMQ inicializada (Colas y DLQs configuradas)');
    } catch (error) {
      this.logger.error('❌ Error configurando la topología de RabbitMQ', error);
    }
  }

  async publishIncomingMessage(message: NormalizedMessageDto) {
    const routingKey = `message.incoming.${message.channel}`;
    const queueName = `incoming_${message.channel}`;

    // Publicar en el exchange principal
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
      `RabbitMQ: mensaje encolado → exchange="telecom_exchange" (rk=${routingKey}) user_id=${message.user_id} preview="${preview}"`,
    );
  }
}