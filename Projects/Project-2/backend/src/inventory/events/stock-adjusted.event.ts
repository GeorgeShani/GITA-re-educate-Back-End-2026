import { DomainEvent } from '@/core/events/domain-event.base';

export class StockAdjustedEvent extends DomainEvent {
  readonly eventName = 'inventory.stock_adjusted';
  readonly aggregateType = 'InventoryItem';

  constructor(
    readonly aggregateId: string,
    readonly delta: number,
    readonly reasonCode: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
