import { DomainEvent } from '../../core/events/domain-event.base';

export class TaxRateCreatedEvent extends DomainEvent {
  readonly eventName = 'tax_rate.created';
  readonly aggregateType = 'TaxRate';

  constructor(
    readonly aggregateId: string,
    readonly countryCode: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
