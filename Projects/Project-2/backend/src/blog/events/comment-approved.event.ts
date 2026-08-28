import { DomainEvent } from '@/core/events/domain-event.base';

export class CommentApprovedEvent extends DomainEvent {
  readonly eventName = 'comment.approved';
  readonly aggregateType = 'Comment';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
