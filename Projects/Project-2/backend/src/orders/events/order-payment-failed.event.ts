import { DomainEvent } from '../../core/events/domain-event.base';

export class OrderPaymentFailedEvent extends DomainEvent {
  readonly eventName = 'order.payment_failed';
  readonly aggregateType = 'Order';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly failureReason: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
