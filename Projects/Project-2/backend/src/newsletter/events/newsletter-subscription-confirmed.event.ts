import { DomainEvent } from '@/core/events/domain-event.base';

// The event name schema comment newsletter-subscriber.schema.ts
// promised ("marketing.newsletter_subscribed... once that happens") —
// this is the one place it's actually written.
export class NewsletterSubscriptionConfirmedEvent extends DomainEvent {
  readonly eventName = 'marketing.newsletter_subscribed';
  readonly aggregateType = 'NewsletterSubscriber';

  constructor(
    readonly aggregateId: string,
    readonly email: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
