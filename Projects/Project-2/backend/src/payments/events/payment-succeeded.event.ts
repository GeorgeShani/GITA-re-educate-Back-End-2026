import { DomainEvent } from '@/core/events/domain-event.base';

export class PaymentSucceededEvent extends DomainEvent {
  readonly eventName = 'payment.succeeded';
  readonly aggregateType = 'Payment';

  constructor(
    readonly aggregateId: string,
    readonly orderId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
