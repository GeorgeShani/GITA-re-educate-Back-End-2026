import type { Clock } from '#/core/clock/clock.js';

/**
 * Deterministic `Clock` for tests. Defaults to a fixed instant rather than
 * real time, so a test that forgets to call `set()` fails obviously (a
 * date far in 2020) instead of silently depending on wall-clock time.
 */
export class FakeClock implements Clock {
  private current: Date;

  constructor(initial: Date = new Date('2020-01-01T00:00:00.000Z')) {
    this.current = initial;
  }

  now(): Date {
    return this.current;
  }

  set(date: Date): void {
    this.current = date;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
