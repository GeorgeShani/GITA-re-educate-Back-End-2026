import { DomainEvent } from '@/core/events/domain-event.base';

export class UserProfileUpdatedEvent extends DomainEvent {
  readonly eventName = 'user.profile_updated';
  readonly aggregateType = 'User';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
