import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { RenderedEmail } from './mail-message.js';
import type { MailTransport } from './mail-transport.js';

/**
 * Prints the email instead of sending it, so an activation or invite link is
 * readable straight from the log with no SMTP account. Prints the plain-text
 * part, which carries the link in full.
 */
@Injectable()
export class ConsoleMailTransport implements MailTransport {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ConsoleMailTransport.name);
  }

  async send(email: RenderedEmail): Promise<void> {
    this.logger.info(
      { to: email.to, subject: email.subject },
      `Email (not sent — MAIL_TRANSPORT=console)\n${email.text}`,
    );
  }
}
