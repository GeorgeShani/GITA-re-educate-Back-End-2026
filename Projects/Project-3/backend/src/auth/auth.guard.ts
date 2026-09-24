import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '#/common/auth/authenticated-user.interface.js';
import { ALLOW_WHEN_SUSPENDED_KEY } from '#/common/auth/allow-when-suspended.decorator.js';
import { IS_PUBLIC_KEY } from '#/common/auth/public.decorator.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { AuthenticationService } from './authentication.service.js';

interface AuthenticatableRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

/**
 * Registered as the first global guard (`APP_GUARD`). Auth here is opt-out:
 * every route needs a valid access token unless marked `@Public()`, so a new
 * route is secure by default and there is no guard to forget to add.
 * `RolesGuard` runs after this and reads the `request.user` it sets.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authentication: AuthenticationService,
    private readonly context: RequestContextService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);
    if (isPublic) return true;

    const request = executionContext.switchToHttp().getRequest<AuthenticatableRequest>();
    const token = bearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const { user, companyStatus } = await this.authentication.authenticate(token);

    if (companyStatus === 'suspended') {
      const allowed = this.reflector.getAllAndOverride<boolean | undefined>(
        ALLOW_WHEN_SUSPENDED_KEY,
        [executionContext.getHandler(), executionContext.getClass()],
      );
      if (!allowed) throw new ForbiddenException('This company is suspended');
    }

    request.user = user;
    this.context.setAuthenticated(user);
    return true;
  }
}

function bearerToken(header: string | string[] | undefined): string | undefined {
  if (typeof header !== 'string') return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1];
}
