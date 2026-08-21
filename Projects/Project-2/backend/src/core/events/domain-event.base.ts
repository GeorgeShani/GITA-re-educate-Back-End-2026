// Every domain event (OrderPlacedEvent, UserRegisteredEvent, ...) extends
// this. `occurredAt` + `correlationId` are what let the audit log and the
// outbox trace one HTTP request all the way through to a sent email or a
// queued job — see SCOPE.md B2 "Cross-cutting".
//
// Concrete events live in each feature module's `events/` folder (e.g.
// `users/events/user-registered.event.ts`), starting from S5 onward —
// this base class is the only piece that belongs to the shared backbone.
export abstract class DomainEvent {
  readonly occurredAt: Date;
  readonly correlationId: string;

  protected constructor(correlationId: string) {
    this.occurredAt = new Date();
    this.correlationId = correlationId;
  }

  /** Dot-namespaced event name used for outbox routing, e.g. "order.placed". */
  abstract readonly eventName: string;

  /** The id of the aggregate this event is about, e.g. an Order's id. */
  abstract readonly aggregateId: string;

  /** The aggregate type, e.g. "Order" — paired with aggregateId in the outbox row. */
  abstract readonly aggregateType: string;
}
