import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { TokenStore } from '@/app/core/services/token-store';

/**
 * Blocks a route unless a token is present. Redirects to /sign-in with the
 * attempted URL preserved in `redirectTo`, so sign-in can send the user
 * back to where they meant to go instead of always landing on `/`.
 *
 * This only checks for a token, not that it's still valid — a rejected
 * request from an expired/revoked token is still caught downstream by
 * auth.interceptor's refresh-then-logout flow. Duplicating that check here
 * would just be a second source of truth for the same decision.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const tokens = inject(TokenStore);
  if (tokens.isAuthenticated()) return true;

  const router = inject(Router);
  return router.createUrlTree(['/sign-in'], { queryParams: { redirectTo: state.url } });
};
