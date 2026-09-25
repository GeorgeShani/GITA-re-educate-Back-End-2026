import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { requestOf } from '#/common/http/request-of.js';
import type { UserRole } from '#/database/entities/user.entity.js';
import type { AuthenticatedUser } from './authenticated-user.interface.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * Registered globally in `AuthModule`, immediately after `AuthGuard`, whose
 * `request.user` it reads — it must never run before it.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() at all means "any authenticated user" — this guard only
    // narrows further, it never grants access the auth guard didn't already.
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = requestOf<{ user?: AuthenticatedUser }>(context);
    const user = request.user;
    return user !== undefined && requiredRoles.includes(user.role);
  }
}
