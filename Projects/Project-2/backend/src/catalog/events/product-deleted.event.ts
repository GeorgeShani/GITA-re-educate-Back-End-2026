import { DomainEvent } from '@/core/events/domain-event.base';

export class ProductDeletedEvent extends DomainEvent {
  readonly eventName = 'product.deleted';
  readonly aggregateType = 'Product';

  // name carried on the event since the audit log has nothing else to
  // show once the Product document itself is gone.
  constructor(
    readonly aggregateId: string,
    readonly name: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
