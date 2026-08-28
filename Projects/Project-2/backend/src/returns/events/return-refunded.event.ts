import { DomainEvent } from '@/core/events/domain-event.base';

export class ReturnRefundedEvent extends DomainEvent {
  readonly eventName = 'return.refunded';
  readonly aggregateType = 'Return';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly refundId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
