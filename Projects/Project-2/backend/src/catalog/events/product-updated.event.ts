import { DomainEvent } from '@/core/events/domain-event.base';

export class ProductUpdatedEvent extends DomainEvent {
  readonly eventName = 'product.updated';
  readonly aggregateType = 'Product';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
