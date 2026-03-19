import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { IdentityModule } from '../identity/identity.module';
import { WhatsAppOutboundService } from './whatsapp-outbound.service';
import { PageMessagingOutboundService } from './page-messaging-outbound.service';
import { ServiceInquiryService } from './service-inquiry.service';

@Module({
  imports: [ConfigModule, HttpModule, IdentityModule],
  providers: [WhatsAppOutboundService, PageMessagingOutboundService, ServiceInquiryService],
  exports: [WhatsAppOutboundService, PageMessagingOutboundService, ServiceInquiryService],
})
export class MetaOutboundModule {}
