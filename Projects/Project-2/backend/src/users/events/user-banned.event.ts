import { DomainEvent } from '../../core/events/domain-event.base';

export class UserBannedEvent extends DomainEvent {
  readonly eventName = 'user.banned';
  readonly aggregateType = 'User';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
