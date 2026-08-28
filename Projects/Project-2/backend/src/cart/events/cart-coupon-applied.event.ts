import { DomainEvent } from '@/core/events/domain-event.base';

export class CartCouponAppliedEvent extends DomainEvent {
  readonly eventName = 'cart.coupon_applied';
  readonly aggregateType = 'Cart';

  constructor(
    readonly aggregateId: string,
    readonly couponCode: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
