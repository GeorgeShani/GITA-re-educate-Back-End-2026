import { DomainEvent } from '../../core/events/domain-event.base';

export class GiftCardUpdatedEvent extends DomainEvent {
  readonly eventName = 'giftcard.updated';
  readonly aggregateType = 'GiftCard';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
