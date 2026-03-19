import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { NormalizerModule } from '../normalizer/normalizer.module';
// No importamos RabbitmqModule aquí porque lo declaramos @Global()

@Module({
  imports: [NormalizerModule],
  controllers: [WebhookController],
})
export class MetaWebhookModule {}