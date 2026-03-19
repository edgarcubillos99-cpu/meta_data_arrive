import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation';

import { RabbitmqModule } from './modules/rabbitmq/rabbitmq.module';
import { MetaWebhookModule } from './modules/meta-webhook/meta-webhook.module';
import { NormalizerModule } from './modules/normalizer/normalizer.module';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module';
import { UbersmithModule } from './modules/ubersmith/ubersmith.module';
import { IdentityModule } from './modules/identity/identity.module';
// Omitimos MediaHandlerModule por ahora para no recargar el ejemplo, pero su estructura es idéntica a NormalizerModule

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
    UbersmithModule,
    IdentityModule,
    
    // 4. Módulos de Entrada/Salida (Endpoints y Workers)
    MetaWebhookModule,
    OrchestratorModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}