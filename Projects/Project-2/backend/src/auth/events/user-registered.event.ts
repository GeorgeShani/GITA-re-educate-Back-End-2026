import { DomainEvent } from '@/core/events/domain-event.base';

export class UserRegisteredEvent extends DomainEvent {
  readonly eventName = 'user.registered';
  readonly aggregateType = 'User';

  constructor(
    readonly aggregateId: string,
    readonly email: string,
    readonly firstName: string,
    readonly verificationUrl: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
