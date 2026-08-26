import { DomainEvent } from '../../core/events/domain-event.base';

export class CartMergedEvent extends DomainEvent {
  readonly eventName = 'cart.merged';
  readonly aggregateType = 'Cart';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly mergedItemCount: number,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
