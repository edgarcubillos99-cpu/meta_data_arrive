import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';

import { RabbitmqModule } from './modules/rabbitmq/rabbitmq.module';
import { MetaWebhookModule } from './modules/meta-webhook/meta-webhook.module';
import { NormalizerModule } from './modules/normalizer/normalizer.module';
import { MetaOutboundModule } from './modules/meta-outbound/meta-outbound.module';

@Module({
  imports: [
    // 1. Configuración global centralizada y validada
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    
    // 2. Infraestructura Global
    RabbitmqModule,

    // 3. Módulos de Dominio / Features
    NormalizerModule,
    /** Envío WhatsApp / Messenger / Instagram (Graph API); la entrada sigue siendo el webhook. */
    MetaOutboundModule,
    
    // 4. Módulos de Entrada/Salida (Endpoints y Workers)
    MetaWebhookModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}