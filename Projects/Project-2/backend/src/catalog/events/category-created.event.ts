import { DomainEvent } from '../../core/events/domain-event.base';

export class CategoryCreatedEvent extends DomainEvent {
  readonly eventName = 'category.created';
  readonly aggregateType = 'Category';

  constructor(
    readonly aggregateId: string,
    readonly name: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
