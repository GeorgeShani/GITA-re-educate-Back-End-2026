import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Resend } from 'resend';

import { QueueName } from '../core/queues/queue-names.enum';
import {
  EmailMessage,
  EmailMessageSchema,
} from './schemas/email-message.schema';
import {
  EmailSuppression,
  EmailSuppressionSchema,
} from './schemas/email-suppression.schema';
import {
  NotificationPreference,
  NotificationPreferenceSchema,
} from './schemas/notification-preference.schema';
import { ConsoleMailProvider } from './mail/console-mail.provider';
import { NoopMailProvider } from './mail/noop-mail.provider';
import { MAIL_PROVIDER_TOKEN } from './mail/mail-provider.interface';
import {
  RESEND_CLIENT_TOKEN,
  ResendMailProvider,
} from './mail/resend-mail.provider';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsConsumer } from './notifications.consumer';
import { TemplateRendererService } from './template-renderer.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmailMessage.name, schema: EmailMessageSchema },
      { name: EmailSuppression.name, schema: EmailSuppressionSchema },
      {
        name: NotificationPreference.name,
        schema: NotificationPreferenceSchema,
      },
    ]),
    // Re-registered here (also registered in CoreModule for
    // OutboxPublisher's producer side) so this module gets its own Queue
    // binding to attach NotificationsConsumer's @Processor to — standard
    // BullMQ+Nest producer/consumer module split.
    BullModule.registerQueue({ name: QueueName.NOTIFICATIONS }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationsConsumer,
    TemplateRendererService,
    {
      // Only constructed when MAIL_PROVIDER=resend, so a dev/test boot
      // never needs a RESEND_API_KEY.
      provide: RESEND_CLIENT_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (configService.get<string>('MAIL_PROVIDER') !== 'resend') {
          return undefined;
        }
        return new Resend(configService.getOrThrow<string>('RESEND_API_KEY'));
      },
    },
    {
      provide: MAIL_PROVIDER_TOKEN,
      inject: [
        ConfigService,
        ConsoleMailProvider,
        NoopMailProvider,
        ResendMailProvider,
      ],
      useFactory: (
        configService: ConfigService,
        consoleProvider: ConsoleMailProvider,
        noopProvider: NoopMailProvider,
        resendProvider: ResendMailProvider,
      ) => {
        switch (configService.get<string>('MAIL_PROVIDER')) {
          case 'resend':
            return resendProvider;
          case 'noop':
            return noopProvider;
          default:
            return consoleProvider;
        }
      },
    },
    ConsoleMailProvider,
    NoopMailProvider,
    ResendMailProvider,
  ],
  exports: [NotificationsService, NotificationPreferencesService],
})
export class NotificationsModule {}
