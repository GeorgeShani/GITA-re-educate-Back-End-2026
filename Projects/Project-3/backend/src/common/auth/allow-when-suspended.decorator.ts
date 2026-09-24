import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHEN_SUSPENDED_KEY = 'allowWhenSuspended';

/**
 * A suspended company is refused everywhere by default. Routes that must stay
 * reachable — reading billing, so a company can see what it owes — opt back in
 * with this. Suspension has no product flow yet (there is no payment
 * integration to fail); today it is set by an operator or a seed.
 */
export const AllowWhenSuspended = () => SetMetadata(ALLOW_WHEN_SUSPENDED_KEY, true);
