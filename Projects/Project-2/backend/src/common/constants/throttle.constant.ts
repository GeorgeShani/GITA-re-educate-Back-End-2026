import { minutes, ThrottlerOptions } from '@nestjs/throttler';

// Ported from Homework 26. WRITE_THROTTLE goes on every mutating route
// (@Throttle(WRITE_THROTTLE)); AUTH_THROTTLE is tighter — SCOPE.md Phase
// 9 calls out rate limiting on auth routes specifically, and 5/min is too
// loose for login/reset-password brute-force resistance.
export const WRITE_THROTTLE: Record<string, ThrottlerOptions> = {
  default: { limit: 5, ttl: minutes(1) },
};

export const AUTH_THROTTLE: Record<string, ThrottlerOptions> = {
  default: { limit: 5, ttl: minutes(15) },
};
