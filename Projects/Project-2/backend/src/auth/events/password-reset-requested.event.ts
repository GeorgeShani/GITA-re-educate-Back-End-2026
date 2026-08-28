import { DomainEvent } from '@/core/events/domain-event.base';

export class PasswordResetRequestedEvent extends DomainEvent {
  readonly eventName = 'user.password_reset_requested';
  readonly aggregateType = 'User';

  constructor(
    readonly aggregateId: string,
    readonly email: string,
    readonly firstName: string,
    readonly resetUrl: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
