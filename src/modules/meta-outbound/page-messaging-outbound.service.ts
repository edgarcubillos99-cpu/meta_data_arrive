import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { MetaMessagingChannel } from '../../common/types/meta-messaging.types';

/**
 * Envío por Messenger e Instagram Direct vía Send API de la página de Facebook
 * (POST /{page-id}/messages). Requiere META_PAGE_ID y META_PAGE_ACCESS_TOKEN.
 * Instagram usa la página vinculada; opcionalmente INSTAGRAM_PAGE_ID si difiere.
 */
@Injectable()
export class PageMessagingOutboundService {
  private readonly logger = new Logger(PageMessagingOutboundService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('META_PAGE_ID')?.trim() &&
        this.config.get<string>('META_PAGE_ACCESS_TOKEN')?.trim(),
    );
  }

  /**
   * @param recipientId PSID (Messenger) o IGSID (Instagram) según el webhook.
   */
  async sendText(
    recipientId: string,
    body: string,
    channel: Extract<MetaMessagingChannel, 'messenger' | 'instagram'>,
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Messenger/Instagram outbound no configurado (META_PAGE_ID / META_PAGE_ACCESS_TOKEN); no se envía mensaje.',
      );
      return;
    }

    const pageId =
      channel === 'instagram'
        ? this.config.get<string>('INSTAGRAM_PAGE_ID')?.trim() ||
          this.config.get<string>('META_PAGE_ID')?.trim()
        : this.config.get<string>('META_PAGE_ID')?.trim();

    const token = this.config.get<string>('META_PAGE_ACCESS_TOKEN')!;
    const version = this.config.get<string>('META_GRAPH_API_VERSION') ?? 'v21.0';

    const url = `https://graph.facebook.com/${version}/${pageId}/messages`;

    await firstValueFrom(
      this.httpService.post(
        url,
        {
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message: { text: body },
        },
        {
          params: { access_token: token },
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    this.logger.log(`Mensaje ${channel} enviado a ${recipientId}`);
  }
}
