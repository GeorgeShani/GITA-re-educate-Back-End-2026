import { SetMetadata } from '@nestjs/common';

export const REQUIRES_SUBSCRIPTION_KEY = 'requiresSubscription';

/**
 * "After logging in, the company must select a plan" — enforced, not assumed.
 * Put on a controller (or route) whose feature needs a live subscription; the
 * global `RequireSubscriptionGuard` answers **402** naming plan selection when
 * the caller's company has none. Applied to `employees/` and `files/`.
 */
export const RequiresSubscription = () => SetMetadata(REQUIRES_SUBSCRIPTION_KEY, true);
