import { inject, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Blocks a route outside dev mode. Used on /styleguide, which has no SEO
 * or customer value and shouldn't ship in production builds.
 *
 * Redirects home rather than returning `false` outright — a guard that
 * just cancels navigation leaves a blank router-outlet on a direct visit
 * or refresh, which is worse than a redirect. F10 can point this at a
 * real 404 page once one exists; the guard's shape won't need to change.
 */
export const devOnlyGuard: CanActivateFn = () => {
  if (isDevMode()) return true;

  const router = inject(Router);
  return router.createUrlTree(['/']);
};
