import { Module } from '@nestjs/common';
import { EnrichmentConsumer } from './enrichment.consumer';
import { MetaOutboundModule } from '../meta-outbound/meta-outbound.module';

@Module({
  imports: [MetaOutboundModule],
  providers: [EnrichmentConsumer],
})
export class OrchestratorModule {}