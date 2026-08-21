// SCOPE.md B2 domain event catalog (Order) mirrors these one-to-one —
// the order state machine (SCOPE.md Phase 4) is enforced in one place
// (the checkout saga + OrderService, S9), never inferred from event
// history, so illegal transitions can be rejected before they happen.
export enum OrderStatus {
  PLACED = 'placed',
  PAID = 'paid',
  PAYMENT_FAILED = 'payment_failed',
  CONFIRMED = 'confirmed',
  FULFILLED = 'fulfilled',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}
