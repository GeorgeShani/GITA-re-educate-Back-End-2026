import { describe, expect, it } from 'vitest';
import { FakeClock } from '#test/support/fake-clock.js';
import { MAX_TASK_ATTEMPTS, computeBackoffMs, nextRunAfter } from './backoff.js';

describe('task backoff', () => {
  it('doubles from 60s after the first failure', () => {
    expect([1, 2, 3, 4].map(computeBackoffMs)).toEqual([60_000, 120_000, 240_000, 480_000]);
  });

  it('schedules the retry relative to the injected clock, not wall time', () => {
    const clock = new FakeClock(new Date('2026-03-01T12:00:00.000Z'));

    expect(nextRunAfter(clock.now(), 2).toISOString()).toBe('2026-03-01T12:02:00.000Z');

    clock.advance(60 * 60_000);
    expect(nextRunAfter(clock.now(), 1).toISOString()).toBe('2026-03-01T13:01:00.000Z');
  });

  it('gives up after five attempts', () => {
    expect(MAX_TASK_ATTEMPTS).toBe(5);
  });
});
