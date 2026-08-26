import { DomainEvent } from '../../core/events/domain-event.base';

export class PasswordChangedEvent extends DomainEvent {
  readonly eventName = 'user.password_changed';
  readonly aggregateType = 'User';

  constructor(
    readonly aggregateId: string,
    readonly email: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
