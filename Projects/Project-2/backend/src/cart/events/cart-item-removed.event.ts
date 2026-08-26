import { DomainEvent } from '../../core/events/domain-event.base';

export class CartItemRemovedEvent extends DomainEvent {
  readonly eventName = 'cart.item_removed';
  readonly aggregateType = 'Cart';

  constructor(
    readonly aggregateId: string,
    readonly itemId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
