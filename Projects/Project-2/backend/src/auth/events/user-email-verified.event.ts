import { DomainEvent } from '../../core/events/domain-event.base';

export class UserEmailVerifiedEvent extends DomainEvent {
  readonly eventName = 'user.email_verified';
  readonly aggregateType = 'User';

  constructor(
    readonly aggregateId: string,
    readonly email: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
