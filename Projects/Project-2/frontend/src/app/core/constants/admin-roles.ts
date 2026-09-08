import type { RoleDto } from '@/app/core/api/dto';

// Mirrors backend/src/common/constants/admin-roles.constant.ts exactly.
// The server is the real enforcement (every admin/* route re-checks this);
// duplicating it here only keeps the client nav/guards from offering a
// link the API would 403 on anyway.
export const ADMIN_ROLES = {
  /** Products, categories, variants, inventory adjustments, media library. */
  catalog: ['admin', 'manager'] as RoleDto[],
  /** Orders, fulfillment, returns, refunds, review moderation. */
  commerce: ['admin', 'support'] as RoleDto[],
  /** Coupons, gift cards, shipping zones, tax rates. */
  money: ['admin', 'manager'] as RoleDto[],
  /** Blog, pages, contact inbox, newsletter, email ops. */
  content: ['admin', 'editor'] as RoleDto[],
  /** User role assignment and bans — admin-only, no delegation. */
  people: ['admin'] as RoleDto[],
} as const;

/** Anyone with a staff role can enter the admin shell; individual areas narrow further via ADMIN_ROLES. */
export const ANY_STAFF_ROLE: RoleDto[] = ['admin', 'manager', 'support', 'editor'];
