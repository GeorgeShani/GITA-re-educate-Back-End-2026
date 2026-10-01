import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isGraphql, requestOf } from '#/common/http/request-of.js';
import { DEMO_WRITES_CHECKED_KEY } from './demo-writes-checked.decorator.js';
import type { AuthenticatedUser } from '#/common/auth/authenticated-user.interface.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const DEMO_READ_ONLY_MESSAGE =
  'This is the read-only demo, so changes are turned off. Create your own company to try everything.';

/**
 * Makes the demo company look-but-don't-touch: every request that could change something
 * (anything but GET/HEAD/OPTIONS) by a user of a demo company is refused, whether it comes
 * from a session or an API key. Registered globally right after `AuthGuard`, so it applies
 * to every route without any route having to remember it — and a NEW write route is
 * covered the day it is added.
 *
 * Reads are safe to leave open, because every read route in this app is a pure read (the
 * rollover job, not a request, is what advances a billing period).
 */
@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType<string>() === 'ws') return true;
    // GraphQL here is read-only by construction (the schema has no mutations), though its transport
    // is a POST — so the method says nothing about it.
    if (isGraphql(context)) return true;
    // A route that is a POST only because of its transport (the MCP endpoint) checks each write itself.
    if (this.reflector.getAllAndOverride<boolean | undefined>(DEMO_WRITES_CHECKED_KEY, [context.getHandler(), context.getClass()]))
      return true;
    const request = requestOf<{ method: string; user?: AuthenticatedUser }>(
      context,
    );
    if (!request.user?.isDemo) return true;
    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
    throw new ForbiddenException(DEMO_READ_ONLY_MESSAGE);
  }
}
