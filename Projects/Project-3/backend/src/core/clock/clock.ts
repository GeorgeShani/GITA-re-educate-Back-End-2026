/**
 * Every place time matters — token expiry, billing periods, proration, the
 * task-queue backoff schedule — reads `Date` through this seam instead of
 * calling `new Date()` directly. That's what lets the billing calculator
 * (the most heavily tested file in the repo, per SCOPE.md) run its date-math
 * tests against exact instants instead of "now, whenever the test happens to
 * run" — see `test/support/fake-clock.ts`.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
