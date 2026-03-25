import { Module, Global } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { RabbitPublisherService } from './rabbit-publisher.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Colas incoming enlazadas al exchange (topic).
 * El webhook solo publica aquí; otro consumidor (p. ej. agente IA) lee de estas colas.
 */
const INCOMING_QUEUES = [
  {
    name: 'incoming_whatsapp',
    exchange: 'telecom_exchange',
    routingKey: 'message.incoming.whatsapp',
    options: {
      durable: true,
      deadLetterExchange: 'telecom_dlx',
      deadLetterRoutingKey: 'message.incoming.whatsapp.dlq',
    },
  },
  {
    name: 'incoming_messenger',
    exchange: 'telecom_exchange',
    routingKey: 'message.incoming.messenger',
    options: {
      durable: true,
      deadLetterExchange: 'telecom_dlx',
      deadLetterRoutingKey: 'message.incoming.messenger.dlq',
    },
  },
  {
    name: 'incoming_instagram',
    exchange: 'telecom_exchange',
    routingKey: 'message.incoming.instagram',
    options: {
      durable: true,
      deadLetterExchange: 'telecom_dlx',
      deadLetterRoutingKey: 'message.incoming.instagram.dlq',
    },
  },
];

@Global() // Lo hacemos global para no tener que importarlo en todos los demás módulos
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const reconnectSec = Math.max(
          1,
          parseInt(configService.get<string>('RABBITMQ_RECONNECT_SECONDS') ?? '5', 10) || 5,
        );
        const heartbeatIntervalSec = Math.max(
          5,
          parseInt(configService.get<string>('RABBITMQ_HEARTBEAT_INTERVAL_SECONDS') ?? '30', 10) ||
            30,
        );

        return {
          exchanges: [
            { name: 'telecom_exchange', type: 'topic' },
            { name: 'telecom_dlx', type: 'topic' }, // Dead Letter Exchange
          ],
          queues: INCOMING_QUEUES,
          uri: configService.get<string>('RABBITMQ_URI') || 'amqp://localhost:5672',
          connectionInitOptions: { wait: false },
          /**
           * amqp-connection-manager: reconexión automática tras caída (p. ej. heartbeat timeout).
           * @see https://github.com/jwalton/node-amqp-connection-manager#connecturls-options
           */
          connectionManagerOptions: {
            /** Espera entre intentos de reconexión tras caída del broker o timeout de heartbeat. */
            reconnectTimeInSeconds: reconnectSec,
            /** Intervalo de heartbeat del gestor (por defecto en la lib es 5s; subir reduce falsos timeouts con red inestable). */
            heartbeatIntervalInSeconds: heartbeatIntervalSec,
          },
        };
      },
    }),
  ],
  providers: [RabbitPublisherService],
  exports: [RabbitMQModule, RabbitPublisherService],
})
export class RabbitmqModule {}