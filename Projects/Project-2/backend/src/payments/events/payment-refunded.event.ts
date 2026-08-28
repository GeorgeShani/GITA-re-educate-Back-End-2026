import { DomainEvent } from '@/core/events/domain-event.base';

export class PaymentRefundedEvent extends DomainEvent {
  readonly eventName = 'payment.refunded';
  readonly aggregateType = 'Refund';

  constructor(
    readonly aggregateId: string,
    readonly orderId: string,
    readonly amountMinor: number,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
