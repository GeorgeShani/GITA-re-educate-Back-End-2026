import { DomainEvent } from '@/core/events/domain-event.base';

export class OrderConfirmedEvent extends DomainEvent {
  readonly eventName = 'order.confirmed';
  readonly aggregateType = 'Order';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
