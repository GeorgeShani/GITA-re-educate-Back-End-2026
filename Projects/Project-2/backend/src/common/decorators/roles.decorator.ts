import { SetMetadata } from '@nestjs/common';
import type { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

// Pairs with RolesGuard. Usage: @Roles(Role.ADMIN, Role.MANAGER) above a
// route — the storefront backend has almost no use for this (admin CRUD
// is out of scope), but a handful of shopper-facing routes still need
// it, e.g. the Ops-category contact/newsletter admin-notification reads.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
