import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { RedisStateService } from './redis-state.service';

@Module({
  providers: [IdentityService, RedisStateService],
  exports: [IdentityService],
})
export class IdentityModule {}