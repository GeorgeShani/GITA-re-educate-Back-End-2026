// SCOPE.md Phase 1 — staff roles plus the default customer role. Every
// registered user gets CUSTOMER; the rest are assigned by an admin (Phase
// 6, out of scope for the storefront backend) or seeded directly.
export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  SUPPORT = 'support',
  EDITOR = 'editor',
  CUSTOMER = 'customer',
}
