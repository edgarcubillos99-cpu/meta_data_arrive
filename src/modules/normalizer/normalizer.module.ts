import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NormalizerService } from './normalizer.service';

@Module({
  imports: [ConfigModule],
  providers: [NormalizerService],
  exports: [NormalizerService], // Exportado para que WebhookController lo use
})
export class NormalizerModule {}