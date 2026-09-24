import { PLAN_CATALOG, type Plan } from './plan-catalog.js';

export interface CompanyUsage {
  /** Employees holding a seat: `invited` and `active` (an invite holds one, D4). */
  employees: number;
  /** Files uploaded so far in the current billing period. */
  files: number;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

const LABEL: Record<Plan, string> = { free: 'Free', basic: 'Basic', premium: 'Premium' };

/**
 * Why a company cannot move to `target` right now — empty when it can. Each
 * message names the numbers that must come down first, so the rejection is
 * actionable rather than just "no".
 *
 * File count only blocks a target that hard-blocks over-quota uploads (Free,
 * Basic). Premium accepts and bills overage, so a company already past 1,000
 * files can still upgrade to it.
 */
export function planChangeProblems(target: Plan, usage: CompanyUsage): string[] {
  const rules = PLAN_CATALOG[target];
  const problems: string[] = [];

  if (rules.maxEmployees !== null && usage.employees > rules.maxEmployees) {
    const excess = usage.employees - rules.maxEmployees;
    problems.push(
      rules.maxEmployees === 0
        ? `${LABEL[target]} has no employee seats, but the company has ${plural(usage.employees, 'employee')} — remove ${excess} first.`
        : `${LABEL[target]} allows ${plural(rules.maxEmployees, 'employee')}, but the company has ${usage.employees} — remove ${excess} first.`,
    );
  }

  if (rules.overagePerFileCents === null && usage.files > rules.filesPerPeriod) {
    problems.push(
      `${LABEL[target]} allows ${plural(rules.filesPerPeriod, 'file')} per period, but ${usage.files} have already been uploaded in this one.`,
    );
  }

  return problems;
}
