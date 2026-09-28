import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_SUSPENDED_KEY = 'allowWhenSuspended';

/**
 * A suspended company is refused everywhere by default. Routes that must stay
 * reachable — billing reads and the Stripe customer portal, so a company can
 * see and fix what it owes — opt back in with this. The dunning evaluator
 * suspends overdue companies and a successful Stripe payment reactivates them.
 */
export const AllowWhenSuspended = () => SetMetadata(ALLOW_WHEN_SUSPENDED_KEY, true);
