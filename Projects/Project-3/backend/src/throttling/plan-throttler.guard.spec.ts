import { describe, expect, it } from 'vitest';
import { PLAN_CATALOG } from '#/subscriptions/plan-catalog.js';
import { throttleMessage } from './plan-throttler.guard.js';

describe('throttleMessage', () => {
  it('names the plan, its limit, when to retry, and the next plan up with ITS limit', () => {
    const message = throttleMessage({ plan: 'free', limit: PLAN_CATALOG.free.rateLimitPerMinute }, 42);

    expect(message).toContain('free plan');
    expect(message).toContain('30 requests per minute');
    expect(message).toContain('42 seconds');
    expect(message).toContain('basic plan');
    expect(message).toContain(`${PLAN_CATALOG.basic.rateLimitPerMinute} requests per minute`);
    expect(message).toContain('PATCH /subscriptions/me');
  });

  it('points Basic at Premium, and offers Premium nothing higher', () => {
    expect(throttleMessage({ plan: 'basic', limit: 120 }, 5)).toContain('premium plan');
    expect(throttleMessage({ plan: 'premium', limit: 600 }, 5)).not.toContain('Upgrade');
  });

  it('says nothing about plans when none is involved (an address, or a route with its own limit)', () => {
    const message = throttleMessage({ plan: null, limit: 10 }, 7);
    expect(message).toBe('Too many requests. Try again in 7 seconds.');
  });
});
