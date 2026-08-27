import { DomainEvent } from '../../core/events/domain-event.base';

export class WishlistItemRemovedEvent extends DomainEvent {
  readonly eventName = 'wishlist.item_removed';
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
