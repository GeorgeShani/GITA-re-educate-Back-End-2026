import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '#/database/entities/user.entity.js';

export const ROLES_KEY = 'roles';

/**
 * `@Roles('admin')` etc. Routes never enumerate raw roles beyond this one
 * call site — `RolesGuard` treats an absent `@Roles()` as "any authenticated
 * user", not "admin only", so a route that forgets it is under-restrictive,
 * never over-restrictive.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
