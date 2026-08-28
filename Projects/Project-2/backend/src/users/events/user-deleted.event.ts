import { DomainEvent } from '@/core/events/domain-event.base';

export class UserDeletedEvent extends DomainEvent {
  readonly eventName = 'user.deleted';
  readonly aggregateType = 'User';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
