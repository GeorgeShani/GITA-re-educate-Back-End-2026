import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '@/core/core.module';
import { AdminNewsletterController } from './admin-newsletter.controller';
import { ConfirmNewsletterSubscriptionHandler } from './commands/handlers/confirm-newsletter-subscription.handler';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import {
  NewsletterSubscriber,
  NewsletterSubscriberSchema,
} from './schemas/newsletter-subscriber.schema';

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: NewsletterSubscriber.name, schema: NewsletterSubscriberSchema },
    ]),
  ],
  controllers: [NewsletterController, AdminNewsletterController],
  providers: [NewsletterService, ConfirmNewsletterSubscriptionHandler],
})
export class NewsletterModule {}
