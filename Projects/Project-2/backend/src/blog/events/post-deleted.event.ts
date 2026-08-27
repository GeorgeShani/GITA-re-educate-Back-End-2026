import { DomainEvent } from '../../core/events/domain-event.base';

export class PostDeletedEvent extends DomainEvent {
  readonly eventName = 'post.deleted';
  readonly aggregateType = 'Post';

  constructor(
    readonly aggregateId: string,
    readonly title: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
