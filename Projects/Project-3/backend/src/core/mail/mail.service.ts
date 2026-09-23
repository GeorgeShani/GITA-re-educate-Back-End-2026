import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
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
  private readonly renderer = new TemplateRenderer();

  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  /** Fail at boot on a broken template, not on the first user's activation. */
  async onModuleInit(): Promise<void> {
    await this.renderer.compile();
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.send(this.renderer.render(message));
  }
}
