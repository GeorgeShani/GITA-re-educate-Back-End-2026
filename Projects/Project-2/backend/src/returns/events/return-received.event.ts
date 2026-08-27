import { DomainEvent } from '../../core/events/domain-event.base';

export class ReturnReceivedEvent extends DomainEvent {
  readonly eventName = 'return.received';
  readonly aggregateType = 'Return';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
