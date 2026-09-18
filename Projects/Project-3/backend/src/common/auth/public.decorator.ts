import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Auth on Gridline is opt-out, not opt-in: once the global auth guard is
 * registered (Milestone 3), every route requires a valid identity and an
 * active subscription unless explicitly marked `@Public()` — registration,
 * login, activation, refresh, accept-invite, the OAuth callback, `/health`.
 * A new route is secure by default; there is no guard to forget to add.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
