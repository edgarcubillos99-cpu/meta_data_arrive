import { Module } from '@nestjs/common';
import { EnrichmentConsumer } from './enrichment.consumer';
import { UbersmithModule } from '../ubersmith/ubersmith.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [UbersmithModule, IdentityModule],
  providers: [EnrichmentConsumer],
})
export class OrchestratorModule {}