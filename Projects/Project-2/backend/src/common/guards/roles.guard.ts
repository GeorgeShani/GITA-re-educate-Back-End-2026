import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestWithUser } from '../interfaces/request-with-user.interface';

// Must run after JwtAuthGuard (which populates request.user) — order
// matters in @UseGuards(JwtAuthGuard, RolesGuard). A route with no
// @Roles() decorator is allowed through for any authenticated user.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userRole = request.user?.role;

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException('Insufficient role for this action');
    }

    return true;
  }
}
