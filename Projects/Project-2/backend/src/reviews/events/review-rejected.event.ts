import { DomainEvent } from '../../core/events/domain-event.base';

export class ReviewRejectedEvent extends DomainEvent {
  readonly eventName = 'review.rejected';
  readonly aggregateType = 'Review';

  constructor(
    readonly aggregateId: string,
    readonly productId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
