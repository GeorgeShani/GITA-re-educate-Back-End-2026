import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { requestOf } from '#/common/http/request-of.js';
import type { AuthenticatedUser } from './authenticated-user.interface.js';
import { REQUIRED_SCOPES_KEY, type ApiScope } from './require-scopes.decorator.js';

/**
 * Registered globally, right after `AuthGuard` (whose `request.user` it reads).
 *
 * A session (JWT) passes straight through — scopes are an API-key concept. An API-key
 * request is DENIED unless the route declares `@RequireScopes(...)` AND the key holds every
 * one. Deny-by-default is the design: a route that never thought about keys (sign-in,
 * credentials, employees, plans, key management…) is closed to them without anyone having
 * to remember to close it, so a leaked key cannot create more persistence.
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = requestOf<{ user?: AuthenticatedUser }>(context).user;
    // No user (a @Public() route) or a session: nothing for this guard to narrow.
    if (!user || user.authMethod !== 'api_key') return true;

    const required = this.reflector.getAllAndOverride<ApiScope[] | undefined>(REQUIRED_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      throw new ForbiddenException('API keys cannot be used with this endpoint.');
    }

    const held = new Set(user.scopes ?? []);
    const missing = required.filter((scope) => !held.has(scope));
    if (missing.length > 0) {
      throw new ForbiddenException(`This API key lacks the required scope: ${missing.join(', ')}.`);
    }
    return true;
  }
}
