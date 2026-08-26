import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import type {
  MailMessage,
  MailProvider,
  MailSendResult,
} from './mail-provider.interface';

// Dev default (MAIL_PROVIDER=console) — no network call, no Resend account
// needed. Writes rendered HTML to dist/mail-out/ and logs the plain-text
// body, per SCOPE.md B4.
@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);
  private readonly outDir = join(process.cwd(), 'dist', 'mail-out');

  // Not async — every step here is synchronous fs/logger work, and
  // `require-await` (rightly) flags an async function with no await in
  // it. Promise.resolve() satisfies the MailProvider interface without
  // pretending there's asynchronous work happening.
  send(message: MailMessage): Promise<MailSendResult> {
    mkdirSync(this.outDir, { recursive: true });
    const fileName = `${Date.now()}-${message.to.replace(/[^a-z0-9]/gi, '_')}.html`;
    writeFileSync(join(this.outDir, fileName), message.html, 'utf8');

    this.logger.log(
      `[mail:console] To: ${message.to} | Subject: ${message.subject}`,
    );
    this.logger.log(`[mail:console] ${message.text}`);
    this.logger.log(`[mail:console] HTML written to dist/mail-out/${fileName}`);

    return Promise.resolve({ providerMessageId: `console-${fileName}` });
  }

  async sendBatch(messages: MailMessage[]): Promise<MailSendResult[]> {
    return Promise.all(messages.map((message) => this.send(message)));
  }

  verifyWebhook(): boolean {
    throw new Error('ConsoleMailProvider has no webhooks to verify');
  }
}
