import { DomainEvent } from '../../core/events/domain-event.base';

export class ShippingZoneCreatedEvent extends DomainEvent {
  readonly eventName = 'shipping_zone.created';
  readonly aggregateType = 'ShippingZone';

  constructor(
    readonly aggregateId: string,
    readonly name: string,
    correlationId: string,
  ) {
    super(correlationId);
  }
}
