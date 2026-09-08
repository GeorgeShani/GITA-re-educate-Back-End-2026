import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import type { RoleDto } from '@/app/core/api/dto';
import { TokenStore } from '@/app/core/services/token-store';

/**
 * Factory, not a plain guard — route config needs to say *which* roles, e.g.
 * `canActivate: [roleGuard(['admin', 'manager'])]`.
 *
 * Reads the JWT's single `role` claim, not `GET /auth/me`'s full `roles`
 * array — that's TokenStore.role's documented contract (see its comment):
 * the claim is what's actually available synchronously for a guard, and
 * it's what the server itself authorizes against. UI that needs to branch
 * on the full role set (e.g. "show all roles this user has") should read
 * AuthService.currentUser() instead; this guard is purely a routing gate.
 *
 * No route consumes this yet — F6 doesn't have anything role-gated. It's
 * built now because F11 (admin) needs it and the plan calls it out as an
 * F6 deliverable alongside authGuard.
 */
export function roleGuard(allowedRoles: readonly RoleDto[]): CanActivateFn {
  return (_route, state) => {
    const tokens = inject(TokenStore);
    const router = inject(Router);

    if (!tokens.isAuthenticated()) {
      return router.createUrlTree(['/sign-in'], { queryParams: { redirectTo: state.url } });
    }

    const role = tokens.role();
    if (role && allowedRoles.includes(role)) return true;

    return router.createUrlTree(['/']);
  };
}
