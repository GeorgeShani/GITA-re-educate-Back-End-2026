import { describe, expect, it } from 'vitest';
import { describeQuotaAlert, nextPlanUp, thresholdsReached } from './quota-alert-rules.js';

describe('thresholdsReached', () => {
  it.each([
    [0, 10, []],
    [7, 10, []],
    [8, 10, [80]],
    [9, 10, [80]],
    [10, 10, [80, 100]],
    [11, 10, [80, 100]],
    [79, 100, []],
    [80, 100, [80]],
    [800, 1000, [80]],
    [1000, 1000, [80, 100]],
  ])('%i of %i reaches %j', (used, limit, expected) => {
    expect(thresholdsReached(used, limit)).toEqual(expected);
  });

  it('does not round: 1 of 3 is not 80% and 3 of 3 is 100%', () => {
    expect(thresholdsReached(1, 3)).toEqual([]);
    expect(thresholdsReached(3, 3)).toEqual([80, 100]);
  });
});

describe('nextPlanUp', () => {
  it('walks the plans in price order and stops at the top', () => {
    expect(nextPlanUp('free')).toBe('basic');
    expect(nextPlanUp('basic')).toBe('premium');
    expect(nextPlanUp('premium')).toBeNull();
  });
});

describe('describeQuotaAlert', () => {
  const base = { filesUsed: 10, filesLimit: 10, resetsOn: '2026-04-01' };

  it('tells Free and Basic that uploads stop, and names the plan that fixes it', () => {
    const free = describeQuotaAlert({ ...base, plan: 'free', threshold: 100 });
    expect(free.detail).toContain('Uploads stop until 2026-04-01');
    expect(free.detail).toContain('basic');

    const basic = describeQuotaAlert({ ...base, plan: 'basic', threshold: 100 });
    expect(basic.detail).toContain('premium');
  });

  it('tells Premium that uploads continue and what the overage costs', () => {
    const premium = describeQuotaAlert({ ...base, plan: 'premium', threshold: 100 });
    expect(premium.detail).toContain('Uploads keep working');
    expect(premium.detail).toContain('$0.50');
  });

  it('warns at 80% with the count and the way out', () => {
    const text = describeQuotaAlert({ ...base, plan: 'free', filesUsed: 8, threshold: 80 });
    expect(text.subject).toContain('80%');
    expect(text.headline).toContain('8 of 10 files');
    expect(text.detail).toContain('basic');
  });
});
