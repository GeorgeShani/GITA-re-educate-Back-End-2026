import { DomainEvent } from '../../core/events/domain-event.base';

export class ReviewSubmittedEvent extends DomainEvent {
  readonly eventName = 'review.submitted';
  readonly aggregateType = 'Review';

  constructor(
    readonly aggregateId: string,
    readonly productId: string,
    readonly isVerifiedPurchase: boolean,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
