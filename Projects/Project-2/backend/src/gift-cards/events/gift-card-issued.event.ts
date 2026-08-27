import { DomainEvent } from '../../core/events/domain-event.base';

// SCOPE.md B4 lists a "giftcard.issued" email — no MJML template exists
// yet (S4 only shipped verify-email/reset-password), so this event
// lands in the audit log via the wildcard route but sends nothing; a
// template is a separate, deliberate addition later, not an oversight.
export class GiftCardIssuedEvent extends DomainEvent {
  readonly eventName = 'giftcard.issued';
  readonly aggregateType = 'GiftCard';

  constructor(
    readonly aggregateId: string,
    readonly code: string,
    readonly initialBalanceMinor: number,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
