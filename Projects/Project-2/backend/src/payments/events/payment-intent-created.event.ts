import { DomainEvent } from '../../core/events/domain-event.base';

export class PaymentIntentCreatedEvent extends DomainEvent {
  readonly eventName = 'payment.intent_created';
  readonly aggregateType = 'Payment';

  constructor(
    readonly aggregateId: string,
    readonly orderId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
