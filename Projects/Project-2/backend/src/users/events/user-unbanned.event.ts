import { DomainEvent } from '../../core/events/domain-event.base';

export class UserUnbannedEvent extends DomainEvent {
  readonly eventName = 'user.unbanned';
  readonly aggregateType = 'User';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
