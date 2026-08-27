import { DomainEvent } from '../../core/events/domain-event.base';

export class ShippingZoneUpdatedEvent extends DomainEvent {
  readonly eventName = 'shipping_zone.updated';
  readonly aggregateType = 'ShippingZone';

  constructor(
    readonly aggregateId: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
