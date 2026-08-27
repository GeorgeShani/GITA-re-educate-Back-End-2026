import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { NewsletterSubscriptionConfirmedEvent } from '../../events/newsletter-subscription-confirmed.event';
import {
  NewsletterSubscriber,
  NewsletterSubscriberDocument,
} from '../../schemas/newsletter-subscriber.schema';
import { ConfirmNewsletterSubscriptionCommand } from '../confirm-newsletter-subscription.command';

@CommandHandler(ConfirmNewsletterSubscriptionCommand)
export class ConfirmNewsletterSubscriptionHandler
  extends TransactionalCommandHandler<ConfirmNewsletterSubscriptionCommand>
  implements ICommandHandler<ConfirmNewsletterSubscriptionCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(NewsletterSubscriber.name)
    private readonly subscriberModel: Model<NewsletterSubscriberDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(
    command: ConfirmNewsletterSubscriptionCommand,
  ): Promise<NewsletterSubscriberDocument> {
    return this.withTransaction(async (session) => {
      const subscriber = await this.subscriberModel
        .findOne({ email: command.email })
        .session(session);
      if (!subscriber) {
        throw new NotFoundException(
          `No subscription found for ${command.email}`,
        );
      }

      // Already confirmed (a re-clicked link) — no-op, no duplicate event.
      if (subscriber.confirmedAt) {
        return subscriber;
      }

      subscriber.confirmedAt = new Date();
      subscriber.unsubscribedAt = null;
      await subscriber.save({ session });

      await this.outboxRepository.write(
        new NewsletterSubscriptionConfirmedEvent(
          subscriber.id,
          subscriber.email,
          command.correlationId,
        ),
        session,
      );

      return subscriber;
    });
  }
}
