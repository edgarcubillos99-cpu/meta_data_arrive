import { Module } from '@nestjs/common';
import { NormalizerService } from './normalizer.service';

@Module({
  providers: [NormalizerService],
  exports: [NormalizerService], // Exportado para que WebhookController lo use
})
export class NormalizerModule {}