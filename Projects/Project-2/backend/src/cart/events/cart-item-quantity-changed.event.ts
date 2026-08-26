import { DomainEvent } from '../../core/events/domain-event.base';

export class CartItemQuantityChangedEvent extends DomainEvent {
  readonly eventName = 'cart.item_quantity_changed';
  readonly aggregateType = 'Cart';

  constructor(
    readonly aggregateId: string,
    readonly itemId: string,
    readonly quantity: number,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
