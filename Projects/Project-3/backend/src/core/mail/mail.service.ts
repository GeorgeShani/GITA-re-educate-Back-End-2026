import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import type { MailMessage } from './mail-message.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport.js';
import { TemplateRenderer } from './template-renderer.js';

/**
 * Renders and delivers. Only the `send_email` task handler calls this —
 * every other module *enqueues* a `send_email` task instead, so an email is
 * sent only after the state change that caused it has committed, and a
 * transport outage retries instead of failing the user's request.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly renderer: TemplateRenderer;

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.renderer = new TemplateRenderer({
      appUrl: config.APP_PUBLIC_URL,
      assetsUrl: config.ASSETS_BASE_URL,
    });
  }

  /** Fail at boot on a broken template, not on the first user's activation. */
  async onModuleInit(): Promise<void> {
    await this.renderer.compile();
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.send(this.renderer.render(message));
  }
}
