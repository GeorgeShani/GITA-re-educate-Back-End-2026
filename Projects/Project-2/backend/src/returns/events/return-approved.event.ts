import { DomainEvent } from '../../core/events/domain-event.base';

export class ReturnApprovedEvent extends DomainEvent {
  readonly eventName = 'return.approved';
  readonly aggregateType = 'Return';

  constructor(
    readonly aggregateId: string,
    readonly userId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
