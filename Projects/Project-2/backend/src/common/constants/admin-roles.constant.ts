import { Role } from '../enums/role.enum';

// The Role enum's four staff values are already named by function, not
// decoration (SCOPE.md Phase 1) — each admin route accepts Role.ADMIN plus
// its area's designated role, never every staff role indiscriminately.
// Usage: @Roles(...ADMIN_ROLES.catalog).
export const ADMIN_ROLES = {
  /** Products, categories, variants, inventory adjustments, media library. */
  catalog: [Role.ADMIN, Role.MANAGER],
  /** Orders, fulfillment, returns, refunds, review moderation. */
  commerce: [Role.ADMIN, Role.SUPPORT],
  /** Coupons, gift cards, shipping zones, tax rates. */
  money: [Role.ADMIN, Role.MANAGER],
  /** Blog, pages, contact inbox, newsletter, email ops. */
  content: [Role.ADMIN, Role.EDITOR],
  /** User role assignment and bans — admin-only, no delegation. */
  people: [Role.ADMIN],
} as const;
