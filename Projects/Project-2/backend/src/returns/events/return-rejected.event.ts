import { DomainEvent } from '../../core/events/domain-event.base';

export class ReturnRejectedEvent extends DomainEvent {
  readonly eventName = 'return.rejected';
  readonly aggregateType = 'Return';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    readonly reason: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
