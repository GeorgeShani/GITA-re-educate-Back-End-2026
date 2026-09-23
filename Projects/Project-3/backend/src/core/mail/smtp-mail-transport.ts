import { createTransport, type Transporter } from 'nodemailer';
import type { RenderedEmail } from './mail-message.js';
import type { MailTransport } from './mail-transport.js';

export interface SmtpSettings {
  host: string;
  port: number;
  user: string | undefined;
  password: string | undefined;
  from: string;
}

export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;

  constructor(private readonly settings: SmtpSettings) {
    this.transporter = createTransport({
      host: settings.host,
      port: settings.port,
      // 465 is implicit TLS; everything else (587) upgrades via STARTTLS.
      secure: settings.port === 465,
      auth:
        settings.user && settings.password
          ? { user: settings.user, pass: settings.password }
          : undefined,
    });
  }

  async send(email: RenderedEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.settings.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }
}
