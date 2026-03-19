import { Module, Global } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { RabbitPublisherService } from './rabbit-publisher.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global() // Lo hacemos global para no tener que importarlo en todos los demás módulos
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        exchanges: [
          { name: 'telecom_exchange', type: 'topic' },
          { name: 'telecom_dlx', type: 'topic' } // Dead Letter Exchange
        ],
        uri: configService.get<string>('RABBITMQ_URI') || 'amqp://localhost:5672',
        connectionInitOptions: { wait: false },
      }),
    }),
  ],
  providers: [RabbitPublisherService],
  exports: [RabbitMQModule, RabbitPublisherService],
})
export class RabbitmqModule {}