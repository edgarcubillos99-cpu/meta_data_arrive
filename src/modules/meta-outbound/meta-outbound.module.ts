import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppOutboundService } from './whatsapp-outbound.service';
import { PageMessagingOutboundService } from './page-messaging-outbound.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [WhatsAppOutboundService, PageMessagingOutboundService],
  exports: [WhatsAppOutboundService, PageMessagingOutboundService],
})
export class MetaOutboundModule {}
