import { DomainEvent } from '../../core/events/domain-event.base';

export class ReturnRequestedEvent extends DomainEvent {
  readonly eventName = 'return.requested';
  readonly aggregateType = 'Return';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly orderId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
