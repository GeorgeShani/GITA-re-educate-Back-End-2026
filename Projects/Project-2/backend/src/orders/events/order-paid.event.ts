import { DomainEvent } from '../../core/events/domain-event.base';

export class OrderPaidEvent extends DomainEvent {
  readonly eventName = 'order.paid';
  readonly aggregateType = 'Order';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
