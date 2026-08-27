import { DomainEvent } from '../../core/events/domain-event.base';

// Also fired for a re-parent (move) — the payload written by
// TransactionalCommandHandler's caller distinguishes it, no separate
// CategoryMovedEvent; see UpdateCategoryHandler.
export class CategoryUpdatedEvent extends DomainEvent {
  readonly eventName = 'category.updated';
  readonly aggregateType = 'Category';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
