import { DomainEvent } from '@/core/events/domain-event.base';

export class CommentRejectedEvent extends DomainEvent {
  readonly eventName = 'comment.rejected';
  readonly aggregateType = 'Comment';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
