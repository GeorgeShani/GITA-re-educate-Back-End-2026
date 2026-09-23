import { Module } from '@nestjs/common';
import type { AppConfig } from '../../config/env.schema.js';
import { APP_CONFIG } from '../../config/load-config.js';
import { ConsoleMailTransport } from './console-mail-transport.js';
import { MAIL_TRANSPORT, type MailTransport } from './mail-transport.js';
import { MailService } from './mail.service.js';
import { SendEmailHandler } from './send-email.handler.js';
import { SmtpMailTransport } from './smtp-mail-transport.js';

@Module({
  providers: [
    ConsoleMailTransport,
    {
      provide: MAIL_TRANSPORT,
      inject: [APP_CONFIG, ConsoleMailTransport],
      useFactory: (config: AppConfig, consoleTransport: ConsoleMailTransport): MailTransport => {
        if (config.MAIL_TRANSPORT === 'console') return consoleTransport;

        // Tier-2 keys are optional in the schema; the module that needs one
        // asserts it here, on first use, with a message that says what to set.
        if (!config.SMTP_HOST || !config.SMTP_PORT) {
          throw new Error('MAIL_TRANSPORT=smtp requires SMTP_HOST and SMTP_PORT to be set.');
        }
        return new SmtpMailTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          user: config.SMTP_USER,
          password: config.SMTP_PASSWORD,
          from: config.MAIL_FROM,
        });
      },
    },
    MailService,
    SendEmailHandler,
  ],
  exports: [MailService, SendEmailHandler],
})
export class MailModule {}
