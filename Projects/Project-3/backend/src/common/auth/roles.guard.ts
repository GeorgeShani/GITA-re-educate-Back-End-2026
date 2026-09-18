import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../database/entities/user.entity.js';
import type { AuthenticatedUser } from './authenticated-user.interface.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * Built now, registered globally in Milestone 3 alongside the auth guard it
 * depends on — `request.user` doesn't exist until then. Must run AFTER the
 * auth guard in whatever composes them, since it reads `request.user`.
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

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    return user !== undefined && requiredRoles.includes(user.role);
  }
}
