import { describe, expect, it } from 'vitest';
import { PLANS, PLAN_CATALOG, maxSeats } from './plan-catalog.js';

/** The numbers the brief specifies. If one of these fails, a constant changed — on purpose? */
describe('PLAN_CATALOG', () => {
  it('free: the admin only, 10 files, $0', () => {
    expect(PLAN_CATALOG.free).toEqual({
      maxEmployees: 0,
      filesPerPeriod: 10,
      seatPriceCents: 0,
      basePriceCents: 0,
      overagePerFileCents: null,
      rateLimitPerMinute: 30,
      maxQualityRules: 3,
    });
  });

  it('basic: 0–10 employees, 100 files, $5 per employee', () => {
    expect(PLAN_CATALOG.basic).toMatchObject({
      maxEmployees: 10,
      filesPerPeriod: 100,
      seatPriceCents: 500,
      overagePerFileCents: null,
    });
  });

  it('premium: unlimited employees, 1000 files, $300 + $0.50 overage', () => {
    expect(PLAN_CATALOG.premium).toMatchObject({
      maxEmployees: null,
      filesPerPeriod: 1000,
      basePriceCents: 30_000,
      overagePerFileCents: 50,
    });
  });

  it('a higher plan never gets a lower rate limit', () => {
    const limits = PLANS.map((plan) => PLAN_CATALOG[plan].rateLimitPerMinute);
    expect(limits).toEqual([...limits].sort((a, b) => a - b));
    expect(new Set(limits).size).toBe(PLANS.length);
  });

  it('a higher plan never allows fewer quality rules, and Premium has no limit', () => {
    const limits = PLANS.map((plan) => PLAN_CATALOG[plan].maxQualityRules);
    expect(limits).toEqual([3, 25, null]);
  });

  it('describes every plan', () => {
    expect(Object.keys(PLAN_CATALOG).sort()).toEqual([...PLANS].sort());
  });

  it('only Premium accepts files past the quota — the others block', () => {
    expect(PLANS.filter((plan) => PLAN_CATALOG[plan].overagePerFileCents !== null)).toEqual(['premium']);
  });

  it('seats are admin + employees (D2)', () => {
    expect(maxSeats('free')).toBe(1);
    expect(maxSeats('basic')).toBe(11);
    expect(maxSeats('premium')).toBeNull();
  });

  it('a full Basic company costs at most $50', () => {
    expect(PLAN_CATALOG.basic.maxEmployees! * PLAN_CATALOG.basic.seatPriceCents).toBe(5_000);
  });
});
