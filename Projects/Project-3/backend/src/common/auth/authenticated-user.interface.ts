import type { UserRole } from '../../database/entities/user.entity.js';

/**
 * What `request.user` holds once `AuthGuard` has authenticated a request.
 * Built from the user's database row on every request, never from the token.
 */
export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  role: UserRole;
}
