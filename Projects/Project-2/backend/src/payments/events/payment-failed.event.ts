import { DomainEvent } from '../../core/events/domain-event.base';

export class PaymentFailedEvent extends DomainEvent {
  readonly eventName = 'payment.failed';
  readonly aggregateType = 'Payment';

  constructor(
    readonly aggregateId: string,
    readonly orderId: string,
    readonly failureReason: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
