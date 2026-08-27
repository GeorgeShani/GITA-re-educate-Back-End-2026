import { DomainEvent } from '../../core/events/domain-event.base';

export class CommentRepliedEvent extends DomainEvent {
  readonly eventName = 'comment.replied';
  readonly aggregateType = 'Comment';

  constructor(
    readonly aggregateId: string,
    readonly parentCommentId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
