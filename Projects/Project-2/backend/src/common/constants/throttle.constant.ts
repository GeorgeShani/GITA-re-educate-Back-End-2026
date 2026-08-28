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

// S13 — SCOPE.md Phase 9 calls out the assistant specifically, alongside
// auth, for its own rate limit: each call is a real (billed) Gemini API
// request, not just a Mongo write, so WRITE_THROTTLE's 5/min is the
// wrong instinct here — a real back-and-forth conversation needs more
// headroom than a form submission does, but still well under the
// ThrottlerModule global default (60/min) that every unthrottled route
// otherwise gets.
export const ASSISTANT_THROTTLE: Record<string, ThrottlerOptions> = {
  default: { limit: 20, ttl: minutes(1) },
};
