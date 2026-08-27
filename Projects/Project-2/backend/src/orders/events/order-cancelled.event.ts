import { DomainEvent } from '../../core/events/domain-event.base';

export class OrderCancelledEvent extends DomainEvent {
  readonly eventName = 'order.cancelled';
  readonly aggregateType = 'Order';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly reason: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
