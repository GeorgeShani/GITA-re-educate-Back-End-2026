import { DomainEvent } from '../../core/events/domain-event.base';

export class CouponUpdatedEvent extends DomainEvent {
  readonly eventName = 'coupon.updated';
  readonly aggregateType = 'Coupon';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
