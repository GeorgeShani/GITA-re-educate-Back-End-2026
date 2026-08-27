import { DomainEvent } from '../../core/events/domain-event.base';

export class GiftCardBalanceAdjustedEvent extends DomainEvent {
  readonly eventName = 'giftcard.balance_adjusted';
  readonly aggregateType = 'GiftCard';

  constructor(
    readonly aggregateId: string,
    readonly delta: number,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
