import { DomainEvent } from '@/core/events/domain-event.base';

export class PostCreatedEvent extends DomainEvent {
  readonly eventName = 'post.created';
  readonly aggregateType = 'Post';

  constructor(
    readonly aggregateId: string,
    readonly title: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
