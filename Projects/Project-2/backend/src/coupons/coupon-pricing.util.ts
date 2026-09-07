import type { CouponDocument } from './schemas/coupon.schema';

export interface CouponEffect {
  discountMinor: number;
  /** The shipping charge after the coupon — unchanged unless it is free_shipping. */
  shippingMinor: number;
}

/**
 * The single definition of what a coupon does to an order's money.
 *
 * Two call sites have to agree exactly: PlaceOrderHandler, which is
 * authoritative because it decides what the customer is actually charged,
 * and CheckoutService.getQuote, which is what the customer is shown
 * beforehand. They previously each did their own arithmetic and had already
 * drifted — the quote taxed the undiscounted subtotal while the handler
 * taxed it post-discount — so a coupon'd cart quoted a total the charge
 * would not match. Keeping the rule in one pure function is what stops that
 * recurring.
 */
export function applyCouponToTotals(
  coupon: CouponDocument | null,
  subtotalMinor: number,
  shippingMinor: number,
): CouponEffect {
  if (!coupon) {
    return { discountMinor: 0, shippingMinor };
  }

  if (coupon.type === 'percentage') {
    return {
      discountMinor: Math.round((subtotalMinor * coupon.value) / 100),
      shippingMinor,
    };
  }

  if (coupon.type === 'fixed') {
    // Never discount below zero — a $50 coupon on a $30 cart is $30 off.
    return {
      discountMinor: Math.min(coupon.value, subtotalMinor),
      shippingMinor,
    };
  }

  // free_shipping — zeroes the shipping charge directly rather than
  // discounting the subtotal, so Order.discountMinor stays 0 for these.
  return { discountMinor: 0, shippingMinor: 0 };
}
