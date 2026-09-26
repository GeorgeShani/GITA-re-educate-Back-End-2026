import { describe, expect, it } from 'vitest';
import { planChangeProblems } from './plan-change.js';

describe('planChangeProblems', () => {
  it('allows any change for a company within the target plan', () => {
    expect(planChangeProblems('basic', { employees: 3, files: 40, qualityRules: 0 })).toEqual([]);
    expect(planChangeProblems('free', { employees: 0, files: 10, qualityRules: 0 })).toEqual([]);
  });

  it('allows exactly the cap, blocks one over', () => {
    expect(planChangeProblems('basic', { employees: 10, files: 100, qualityRules: 0 })).toEqual([]);
    expect(planChangeProblems('basic', { employees: 11, files: 0, qualityRules: 0 })).toHaveLength(1);
    expect(planChangeProblems('basic', { employees: 0, files: 101, qualityRules: 0 })).toHaveLength(1);
  });

  it('blocks a target that allows fewer quality rules than the company has, naming the excess', () => {
    expect(planChangeProblems('free', { employees: 0, files: 0, qualityRules: 3 })).toEqual([]);
    expect(planChangeProblems('free', { employees: 0, files: 0, qualityRules: 5 })).toEqual([
      'Free allows 3 quality rules, but the company has 5 — delete 2 first.',
    ]);
    expect(planChangeProblems('basic', { employees: 0, files: 0, qualityRules: 26 })).toHaveLength(1);
    expect(planChangeProblems('premium', { employees: 0, files: 0, qualityRules: 500 })).toEqual([]);
  });

  it('names the employee excess in the message', () => {
    expect(planChangeProblems('basic', { employees: 13, files: 0, qualityRules: 0 })).toEqual([
      'Basic allows 10 employees, but the company has 13 — remove 3 first.',
    ]);
  });

  it('says Free has no employee seats, rather than "allows 0 employees"', () => {
    expect(planChangeProblems('free', { employees: 1, files: 0, qualityRules: 0 })).toEqual([
      'Free has no employee seats, but the company has 1 employee — remove 1 first.',
    ]);
  });

  it('names the file overage', () => {
    expect(planChangeProblems('basic', { employees: 0, files: 150, qualityRules: 0 })).toEqual([
      'Basic allows 100 files per period, but 150 have already been uploaded in this one.',
    ]);
  });

  it('blocks a downgrade while one dataset exceeds the target version cap', () => {
    expect(
      planChangeProblems('free', {
        employees: 0,
        files: 5,
        qualityRules: 0,
        maxDatasetVersions: 6,
      }),
    ).toEqual([
      'Free keeps up to 5 versions per file, but one dataset has 6 — delete old versions first.',
    ]);
    expect(
      planChangeProblems('premium', {
        employees: 0,
        files: 5,
        qualityRules: 0,
        maxDatasetVersions: 500,
      }),
    ).toEqual([]);
  });

  it('reports every problem at once, not just the first', () => {
    expect(planChangeProblems('free', { employees: 4, files: 50, qualityRules: 0 })).toHaveLength(2);
  });

  it('never blocks Premium — it has no cap and bills overage instead', () => {
    expect(planChangeProblems('premium', { employees: 500, files: 50_000, qualityRules: 0 })).toEqual([]);
  });
});
