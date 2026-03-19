import { Module } from '@nestjs/common';
import { EnrichmentConsumer } from './enrichment.consumer';
import { UbersmithModule } from '../ubersmith/ubersmith.module';
import { IdentityModule } from '../identity/identity.module';
import { MetaOutboundModule } from '../meta-outbound/meta-outbound.module';

@Module({
  imports: [UbersmithModule, IdentityModule, MetaOutboundModule],
  providers: [EnrichmentConsumer],
})
export class OrchestratorModule {}