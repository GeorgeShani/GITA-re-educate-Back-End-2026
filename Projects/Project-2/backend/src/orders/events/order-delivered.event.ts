import { DomainEvent } from '../../core/events/domain-event.base';

export class OrderDeliveredEvent extends DomainEvent {
  readonly eventName = 'order.delivered';
  readonly aggregateType = 'Order';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
