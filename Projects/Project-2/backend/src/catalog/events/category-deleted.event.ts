import { DomainEvent } from '@/core/events/domain-event.base';

export class CategoryDeletedEvent extends DomainEvent {
  readonly eventName = 'category.deleted';
  readonly aggregateType = 'Category';

  constructor(
    readonly aggregateId: string,
    readonly name: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
