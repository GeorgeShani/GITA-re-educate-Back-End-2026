import type { OrderStatus, ReturnStatus, ReviewStatus } from '@/app/core/api/dto';
import type { StatusBadgeVariant } from '@/app/shared/ui/status-badge';

/**
 * The one place order/return/review state is turned into a human label +
 * a status-badge colour. Every list that shows a state badge reads from
 * here, so "delivered" is the same green in the account area and the
 * admin table instead of each page hardcoding its own `custom` colour
 * (which had every in-flight state rendering the same green).
 */
export interface StatusMeta {
  readonly label: string;
  readonly variant: StatusBadgeVariant;
}

const ORDER: Record<OrderStatus, StatusMeta> = {
  placed: { label: 'Placed', variant: 'neutral' },
  paid: { label: 'Paid', variant: 'info' },
  confirmed: { label: 'Confirmed', variant: 'info' },
  fulfilled: { label: 'Fulfilled', variant: 'info' },
  shipped: { label: 'Shipped', variant: 'info' },
  delivered: { label: 'Delivered', variant: 'success' },
  payment_failed: { label: 'Payment failed', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  refunded: { label: 'Refunded', variant: 'warning' },
};

const RETURN: Record<ReturnStatus, StatusMeta> = {
  requested: { label: 'Requested', variant: 'neutral' },
  approved: { label: 'Approved', variant: 'info' },
  received: { label: 'Received', variant: 'info' },
  refunded: { label: 'Refunded', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
};

const REVIEW: Record<ReviewStatus, StatusMeta> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
};

export function orderStatusMeta(status: OrderStatus): StatusMeta {
  return ORDER[status] ?? { label: status, variant: 'neutral' };
}

export function returnStatusMeta(status: ReturnStatus): StatusMeta {
  return RETURN[status] ?? { label: status, variant: 'neutral' };
}

export function reviewStatusMeta(status: ReviewStatus): StatusMeta {
  return REVIEW[status] ?? { label: status, variant: 'neutral' };
}
