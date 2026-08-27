import { DomainEvent } from '../../core/events/domain-event.base';

export class ReviewRepliedEvent extends DomainEvent {
  readonly eventName = 'review.replied';
  readonly aggregateType = 'Review';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
