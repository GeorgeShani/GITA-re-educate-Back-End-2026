import { DomainEvent } from '../../core/events/domain-event.base';

export class CouponCreatedEvent extends DomainEvent {
  readonly eventName = 'coupon.created';
  readonly aggregateType = 'Coupon';

  constructor(
    readonly aggregateId: string,
    readonly code: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
