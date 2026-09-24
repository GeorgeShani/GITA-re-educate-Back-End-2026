import { describe, expect, it } from 'vitest';
import { planChangeProblems } from './plan-change.js';

describe('planChangeProblems', () => {
  it('allows any change for a company within the target plan', () => {
    expect(planChangeProblems('basic', { employees: 3, files: 40 })).toEqual([]);
    expect(planChangeProblems('free', { employees: 0, files: 10 })).toEqual([]);
  });

  it('allows exactly the cap, blocks one over', () => {
    expect(planChangeProblems('basic', { employees: 10, files: 100 })).toEqual([]);
    expect(planChangeProblems('basic', { employees: 11, files: 0 })).toHaveLength(1);
    expect(planChangeProblems('basic', { employees: 0, files: 101 })).toHaveLength(1);
  });

  it('names the employee excess in the message', () => {
    expect(planChangeProblems('basic', { employees: 13, files: 0 })).toEqual([
      'Basic allows 10 employees, but the company has 13 — remove 3 first.',
    ]);
  });

  it('says Free has no employee seats, rather than "allows 0 employees"', () => {
    expect(planChangeProblems('free', { employees: 1, files: 0 })).toEqual([
      'Free has no employee seats, but the company has 1 employee — remove 1 first.',
    ]);
  });

  it('names the file overage', () => {
    expect(planChangeProblems('basic', { employees: 0, files: 150 })).toEqual([
      'Basic allows 100 files per period, but 150 have already been uploaded in this one.',
    ]);
  });

  it('reports every problem at once, not just the first', () => {
    expect(planChangeProblems('free', { employees: 4, files: 50 })).toHaveLength(2);
  });

  it('never blocks Premium — it has no cap and bills overage instead', () => {
    expect(planChangeProblems('premium', { employees: 500, files: 50_000 })).toEqual([]);
  });
});
