import type { RoleDto } from '@/app/core/api/dto';

// Mirrors backend/src/common/constants/admin-roles.constant.ts exactly.
// The server is the real enforcement (every admin/* route re-checks this);
// duplicating it here only keeps the client nav/guards from offering a
// link the API would 403 on anyway.
export const ADMIN_ROLES = {
  /** Products, categories, variants, inventory adjustments, media library. */
  catalog: ['admin', 'manager'],
  /** Orders, fulfillment, returns, refunds, review moderation. */
  commerce: ['admin', 'support'],
  /** Coupons, gift cards, shipping zones, tax rates. */
  money: ['admin', 'manager'],
  /** Blog, pages, contact inbox, newsletter, email ops. */
  content: ['admin', 'editor'],
  /** User role assignment and bans — admin-only, no delegation. */
  people: ['admin'],
  // `as const` narrows each array to a literal tuple; `satisfies` then checks
  // every entry is a real RoleDto without widening those literal types back
  // to `RoleDto[]` — the two were fighting each other before (an `as const`
  // object whose values were separately widened with `as RoleDto[]`).
} as const satisfies Record<string, readonly RoleDto[]>;

/** Anyone with a staff role can enter the admin shell; individual areas narrow further via ADMIN_ROLES. */
export const ANY_STAFF_ROLE: RoleDto[] = ['admin', 'manager', 'support', 'editor'];
