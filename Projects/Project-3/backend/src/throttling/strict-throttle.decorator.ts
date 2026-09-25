import { applyDecorators, SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

export const STRICT_THROTTLE_KEY = 'strictThrottle';

/**
 * A tight, PER-ROUTE, per-address limit for the public routes that cost something or can be
 * abused (sign-in, "send me an email" endpoints). It replaces the general limit for that
 * route and has a bucket of its own, so hammering `/auth/login` cannot be undone by the
 * budget the rest of the app enjoys — and does not spend it either.
 */
export const StrictThrottle = (limit: number, ttlMs = 60_000) =>
  applyDecorators(
    Throttle({ default: { limit, ttl: ttlMs } }),
    SetMetadata(STRICT_THROTTLE_KEY, true),
  );
