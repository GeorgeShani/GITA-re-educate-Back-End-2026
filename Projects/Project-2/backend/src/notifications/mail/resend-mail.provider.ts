import { createHmac, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

import type {
  MailMessage,
  MailProvider,
  MailSendResult,
} from './mail-provider.interface';

export const RESEND_CLIENT_TOKEN = Symbol('RESEND_CLIENT');

// Production provider (MAIL_PROVIDER=resend). Webhook signatures use
// Resend's Svix-based scheme (svix-id/svix-timestamp/svix-signature
// headers, HMAC-SHA256 over `${id}.${timestamp}.${payload}`, secret is
// base64 after stripping the "whsec_" prefix) — verified by hand here
// rather than pulling in the svix SDK for three lines of HMAC.
@Injectable()
export class ResendMailProvider implements MailProvider {
  constructor(
    @Inject(RESEND_CLIENT_TOKEN) private readonly client: Resend,
    private readonly configService: ConfigService,
  ) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const from = `${this.configService.getOrThrow<string>('MAIL_FROM_NAME')} <${this.configService.getOrThrow<string>('MAIL_FROM')}>`;
    const replyTo =
      this.configService.get<string>('MAIL_REPLY_TO') || undefined;

    const { data, error } = await this.client.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo,
    });

    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }

    return { providerMessageId: data?.id };
  }

  async sendBatch(messages: MailMessage[]): Promise<MailSendResult[]> {
    return Promise.all(messages.map((message) => this.send(message)));
  }

  verifyWebhook(
    payload: string,
    headers: Record<string, string | undefined>,
  ): boolean {
    const secret = this.configService.getOrThrow<string>('MAIL_WEBHOOK_SECRET');
    const svixId = headers['svix-id'];
    const svixTimestamp = headers['svix-timestamp'];
    const svixSignature = headers['svix-signature'];

    if (!svixId || !svixTimestamp || !svixSignature) {
      return false;
    }

    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
    const expectedSignature = createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    // svix-signature carries one or more space-separated "v1,<base64>" pairs.
    return svixSignature.split(' ').some((candidate) => {
      const [, sig] = candidate.split(',');
      if (!sig) return false;
      try {
        return timingSafeEqual(
          Buffer.from(sig, 'base64'),
          Buffer.from(expectedSignature, 'base64'),
        );
      } catch {
        return false; // length mismatch -> not a match, not a crash
      }
    });
  }
}
