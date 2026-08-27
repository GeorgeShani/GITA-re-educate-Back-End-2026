import { DomainEvent } from '../../core/events/domain-event.base';

export class ProductCreatedEvent extends DomainEvent {
  readonly eventName = 'product.created';
  readonly aggregateType = 'Product';

  constructor(
    readonly aggregateId: string,
    readonly name: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
