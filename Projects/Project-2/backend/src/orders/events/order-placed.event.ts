import { DomainEvent } from '../../core/events/domain-event.base';

export class OrderPlacedEvent extends DomainEvent {
  readonly eventName = 'order.placed';
  readonly aggregateType = 'Order';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly totalMinor: number,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
