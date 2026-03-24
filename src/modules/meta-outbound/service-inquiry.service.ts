import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityService } from '../identity/identity.service';
import { WhatsAppOutboundService } from './whatsapp-outbound.service';
import { PageMessagingOutboundService } from './page-messaging-outbound.service';
import { NormalizedMessageDto } from '../../common/dtos/normalized-message.dto';
import type { MetaMessagingChannel } from '../../common/types/meta-messaging.types';

const DEFAULT_INQUIRY_MESSAGE =
  'Hola 👋 Antes de continuar, ¿ya cuentas con algún servicio contratado con nosotros? Responde sí o no para orientarte mejor.';

/**
 * Envía una pregunta inicial para distinguir clientes actuales vs potenciales
 * en WhatsApp, Messenger e Instagram. El agente downstream puede usar esa señal
 * para decidir consultas externas (p. ej. CRM) por su cuenta.
 */
@Injectable()
export class ServiceInquiryService {
  private readonly logger = new Logger(ServiceInquiryService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly identity: IdentityService,
    private readonly whatsapp: WhatsAppOutboundService,
    private readonly pageMessaging: PageMessagingOutboundService,
  ) {}

  async sendPreEnrichmentInquiryIfNeeded(msg: NormalizedMessageDto | any): Promise<void> {
    const channel = msg.channel as MetaMessagingChannel | undefined;
    if (!channel || !this.isMetaChannel(channel)) {
      return;
    }

    const outboundReady = this.isOutboundReadyForChannel(channel);
    if (!outboundReady) {
      this.logger.debug(`Omitiendo pregunta de servicio: outbound no configurado para canal ${channel}.`);
      return;
    }

    const sendOnce = this.config.get<string>('SERVICE_INQUIRY_SEND_ONCE', 'true') !== 'false';
    if (sendOnce && (await this.identity.wasServiceInquirySent(channel, msg.user_id))) {
      return;
    }

    const text =
      this.config.get<string>('SERVICE_INQUIRY_MESSAGE')?.trim() || DEFAULT_INQUIRY_MESSAGE;

    try {
      await this.dispatchOutbound(channel, msg.user_id, text);
      if (sendOnce) {
        await this.identity.markServiceInquirySent(channel, msg.user_id);
      }
    } catch (err: any) {
      this.logger.error(
        `No se pudo enviar la pregunta de servicio (${channel}): ${err?.message ?? err}`,
        err?.stack,
      );
    }
  }

  private isMetaChannel(c: string): c is MetaMessagingChannel {
    return c === 'whatsapp' || c === 'messenger' || c === 'instagram';
  }

  private isOutboundReadyForChannel(channel: MetaMessagingChannel): boolean {
    if (channel === 'whatsapp') return this.whatsapp.isConfigured();
    return this.pageMessaging.isConfigured();
  }

  private async dispatchOutbound(
    channel: MetaMessagingChannel,
    userId: string,
    text: string,
  ): Promise<void> {
    switch (channel) {
      case 'whatsapp':
        await this.whatsapp.sendText(userId, text);
        break;
      case 'messenger':
        await this.pageMessaging.sendText(userId, text, 'messenger');
        break;
      case 'instagram':
        await this.pageMessaging.sendText(userId, text, 'instagram');
        break;
      default:
        break;
    }
  }
}
