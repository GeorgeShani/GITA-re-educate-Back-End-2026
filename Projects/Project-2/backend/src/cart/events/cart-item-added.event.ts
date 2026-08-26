import { DomainEvent } from '../../core/events/domain-event.base';

export class CartItemAddedEvent extends DomainEvent {
  readonly eventName = 'cart.item_added';
  readonly aggregateType = 'Cart';

  constructor(
    readonly aggregateId: string,
    readonly productId: string,
    readonly variantSku: string,
    readonly quantity: number,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
