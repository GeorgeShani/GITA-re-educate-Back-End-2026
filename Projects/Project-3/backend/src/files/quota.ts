import { PLAN_CATALOG, type Plan } from '#/subscriptions/plan-catalog.js';

export type QuotaDecision =
  | { kind: 'ok' }
  /** Premium only: accepted, and this file is billed as overage. */
  | { kind: 'overage'; plan: Plan; fileNumber: number; limit: number; overageCents: number }
  /** Free/Basic: refused, and nothing is stored. */
  | { kind: 'blocked'; plan: Plan; used: number; limit: number; resetsOn: string };

/**
 * Whether the next upload fits. `used` is the files already uploaded this billing
 * period; the file being decided is number `used + 1`. Pure, so every edge (the last
 * free slot, the first overage file) is a unit test rather than a hope.
 *
 * Free and Basic hard-block at their cap; Premium never blocks, it accrues overage.
 * `periodEnd` is exclusive — the instant the next period, and a fresh quota, begins.
 */
export function quotaDecision(plan: Plan, used: number, periodEnd: Date): QuotaDecision {
  const rules = PLAN_CATALOG[plan];
  const fileNumber = used + 1;
  if (fileNumber <= rules.filesPerPeriod) return { kind: 'ok' };

  if (rules.overagePerFileCents === null) {
    return {
      kind: 'blocked',
      plan,
      used,
      limit: rules.filesPerPeriod,
      resetsOn: periodEnd.toISOString().slice(0, 10),
    };
  }
  return {
    kind: 'overage',
    plan,
    fileNumber,
    limit: rules.filesPerPeriod,
    overageCents: rules.overagePerFileCents,
  };
}

export function blockedMessage(decision: Extract<QuotaDecision, { kind: 'blocked' }>): string {
  return (
    `Your ${decision.plan} plan allows ${decision.limit} files per billing period and you have ` +
    `uploaded ${decision.used}. The quota resets on ${decision.resetsOn}. ` +
    'Upgrade with PATCH /subscriptions/me to upload more now.'
  );
}

/** The `X-Gridline-Quota-Warning` value: ASCII only, since it is an HTTP header. */
export function overageWarning(decision: Extract<QuotaDecision, { kind: 'overage' }>): string {
  const dollars = (decision.overageCents / 100).toFixed(2);
  return (
    `This is file ${decision.fileNumber} of ${decision.limit} included this period on the ` +
    `${decision.plan} plan; a $${dollars} overage charge applies to it.`
  );
}
