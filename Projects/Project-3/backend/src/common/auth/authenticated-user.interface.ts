import type { UserRole } from '../../database/entities/user.entity.js';

/**
 * What `request.user` holds once an auth guard populates it (Milestone 3).
 * Nothing in Phase 3 sets this yet — the decorators below are shipped ahead
 * of their populator, same as `@Public()`/`RolesGuard`, so the guard's
 * eventual registration is a one-line change these are already watching for.
 */
export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  role: UserRole;
}
