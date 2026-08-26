import { DomainEvent } from '../../core/events/domain-event.base';

export class UserLoggedInEvent extends DomainEvent {
  readonly eventName = 'user.logged_in';
  readonly aggregateType = 'User';

  constructor(readonly aggregateId: string, correlationId: string) {
    super(correlationId);
  }
}
