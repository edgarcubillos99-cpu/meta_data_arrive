import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Envío de mensajes vía WhatsApp Cloud API (Meta Graph).
 * Requiere WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_GRAPH_API_TOKEN.
 */
@Injectable()
export class WhatsAppOutboundService {
  private readonly logger = new Logger(WhatsAppOutboundService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')?.trim() &&
        this.config.get<string>('WHATSAPP_GRAPH_API_TOKEN')?.trim(),
    );
  }

  /**
   * `to` debe ser el número en formato internacional sin + (ej. el mismo `from` del webhook).
   */
  async sendText(to: string, body: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'WhatsApp outbound no configurado (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_GRAPH_API_TOKEN); no se envía mensaje.',
      );
      return;
    }

    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')!;
    const token = this.config.get<string>('WHATSAPP_GRAPH_API_TOKEN')!;
    const version = this.config.get<string>('WHATSAPP_GRAPH_API_VERSION') ?? 'v21.0';
    const recipient = to.replace(/\D/g, '');

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

    await firstValueFrom(
      this.httpService.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    this.logger.log(`Mensaje WhatsApp enviado a ${recipient}`);
  }
}
