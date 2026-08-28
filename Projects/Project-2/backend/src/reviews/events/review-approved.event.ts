import { DomainEvent } from '@/core/events/domain-event.base';

export class ReviewApprovedEvent extends DomainEvent {
  readonly eventName = 'review.approved';
  readonly aggregateType = 'Review';

  constructor(
    readonly aggregateId: string,
    readonly productId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
