import { DomainEvent } from '@/core/events/domain-event.base';

export class TaxRateUpdatedEvent extends DomainEvent {
  readonly eventName = 'tax_rate.updated';
  readonly aggregateType = 'TaxRate';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
