import { DomainEvent } from '@/core/events/domain-event.base';

export class OrderShippedEvent extends DomainEvent {
  readonly eventName = 'order.shipped';
  readonly aggregateType = 'Order';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly trackingNumber: string | undefined,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
