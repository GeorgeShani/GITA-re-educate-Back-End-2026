import { DomainEvent } from '../../core/events/domain-event.base';

export class WishlistItemAddedEvent extends DomainEvent {
  readonly eventName = 'wishlist.item_added';
  readonly aggregateType = 'WishlistItem';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly productId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
