import { DomainEvent } from '@/core/events/domain-event.base';

export class PostUpdatedEvent extends DomainEvent {
  readonly eventName = 'post.updated';
  readonly aggregateType = 'Post';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
