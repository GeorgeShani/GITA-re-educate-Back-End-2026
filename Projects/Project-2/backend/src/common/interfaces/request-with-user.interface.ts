import type { Request } from 'express';
import type { Role } from '@/common/enums/role.enum';

// Extends Homework 25/26's shape with `role`, needed by RolesGuard —
// the storefront backend has staff roles (SCOPE.md Phase 1) that the
// homework's single-role model didn't need.
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
