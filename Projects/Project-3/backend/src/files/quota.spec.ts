import { describe, expect, it } from 'vitest';
import { blockedMessage, overageWarning, quotaDecision } from './quota.js';

const PERIOD_END = new Date('2026-04-01T00:00:00.000Z');

describe('quotaDecision', () => {
  describe.each([
    ['free', 10],
    ['basic', 100],
  ] as const)('%s (cap %i, hard block)', (plan, cap) => {
    it('accepts every file up to and including the cap', () => {
      expect(quotaDecision(plan, 0, PERIOD_END)).toEqual({ kind: 'ok' });
      expect(quotaDecision(plan, cap - 1, PERIOD_END)).toEqual({ kind: 'ok' });
    });

    it('blocks the file after the cap, naming plan, count, cap and reset date', () => {
      expect(quotaDecision(plan, cap, PERIOD_END)).toEqual({
        kind: 'blocked',
        plan,
        used: cap,
        limit: cap,
        resetsOn: '2026-04-01',
      });
    });

    it('keeps blocking far past the cap', () => {
      expect(quotaDecision(plan, cap + 500, PERIOD_END).kind).toBe('blocked');
    });
  });

  describe('premium (1000 included, then $0.50 each — never blocked)', () => {
    it('is ok up to the 1000th file', () => {
      expect(quotaDecision('premium', 998, PERIOD_END).kind).toBe('ok');
      expect(quotaDecision('premium', 999, PERIOD_END).kind).toBe('ok');
    });

    it('accepts the 1001st, as overage', () => {
      expect(quotaDecision('premium', 1000, PERIOD_END)).toEqual({
        kind: 'overage',
        plan: 'premium',
        fileNumber: 1001,
        limit: 1000,
        overageCents: 50,
      });
    });

    it('never blocks, however far over', () => {
      expect(quotaDecision('premium', 50_000, PERIOD_END).kind).toBe('overage');
    });
  });
});

describe('messages', () => {
  it('the block message says exactly what the customer needs to act', () => {
    const decision = quotaDecision('basic', 100, PERIOD_END);
    if (decision.kind !== 'blocked') throw new Error('expected blocked');

    const message = blockedMessage(decision);
    expect(message).toContain('basic');
    expect(message).toContain('100');
    expect(message).toContain('2026-04-01');
    expect(message).toContain('PATCH /subscriptions/me');
  });

  it('the overage warning is a plain ASCII header value stating the charge', () => {
    const decision = quotaDecision('premium', 1000, PERIOD_END);
    if (decision.kind !== 'overage') throw new Error('expected overage');

    const warning = overageWarning(decision);
    expect(warning).toContain('1001');
    expect(warning).toContain('$0.50');
    // eslint-disable-next-line no-control-regex
    expect(warning).toMatch(/^[\x20-\x7e]+$/);
  });
});
