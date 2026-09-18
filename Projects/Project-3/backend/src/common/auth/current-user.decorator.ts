import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthenticatedUser } from './authenticated-user.interface.js';

/**
 * `@CurrentUser()` for the whole object, `@CurrentUser('userId')` for one
 * field. The `keyof AuthenticatedUser` parameter type is what makes a typo —
 * `@CurrentUser('usreId')` — a compile error instead of a silent runtime
 * `undefined`, replacing `Datodia/nestjs-starter`'s untyped
 * `request.userId`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    return data ? request.user?.[data] : request.user;
  },
);
