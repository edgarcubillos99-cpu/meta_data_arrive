import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { MemoryStateService } from './memory-state.service';

@Module({
  providers: [IdentityService, MemoryStateService],
  exports: [IdentityService],
})
export class IdentityModule {}