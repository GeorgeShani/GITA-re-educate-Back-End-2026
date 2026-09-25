import { PLAN_CATALOG, PLANS, type Plan } from '#/subscriptions/plan-catalog.js';

/** The points at which a company is told how much of its file quota is gone. */
export const QUOTA_ALERT_THRESHOLDS = [80, 100] as const;
export type QuotaAlertThreshold = (typeof QUOTA_ALERT_THRESHOLDS)[number];

/**
 * The thresholds `filesUsed` has reached. Integer maths only: `used / limit >= t / 100` is
 * `used * 100 >= t * limit`, so 8 of 10 is exactly 80% and 79 of 100 is not.
 */
export function thresholdsReached(filesUsed: number, filesLimit: number): QuotaAlertThreshold[] {
  return QUOTA_ALERT_THRESHOLDS.filter((threshold) => filesUsed * 100 >= threshold * filesLimit);
}

/** The next plan up, or null on the top one. Plans are declared cheapest first. */
export function nextPlanUp(plan: Plan): Plan | null {
  return PLANS[PLANS.indexOf(plan) + 1] ?? null;
}

export interface QuotaAlertText {
  subject: string;
  headline: string;
  detail: string;
}

/**
 * The words for the email. 100% is the actionable one: Free and Basic stop accepting uploads,
 * Premium keeps going and starts billing overage, and either way the reader is told what to do.
 */
export function describeQuotaAlert(input: {
  plan: Plan;
  threshold: QuotaAlertThreshold;
  filesUsed: number;
  filesLimit: number;
  resetsOn: string;
}): QuotaAlertText {
  const { plan, threshold, filesUsed, filesLimit, resetsOn } = input;
  const rules = PLAN_CATALOG[plan];
  const upgrade = nextPlanUp(plan);
  const used = `${filesUsed} of ${filesLimit} files`;

  if (threshold < 100) {
    return {
      subject: `You have used ${threshold}% of your file quota`,
      headline: `${used} used this billing period on the ${plan} plan.`,
      detail:
        upgrade === null
          ? `Uploads past ${filesLimit} are still accepted and billed as overage.`
          : `At ${filesLimit} files uploads stop until ${resetsOn}, unless you move to the ${upgrade} plan.`,
    };
  }

  if (rules.overagePerFileCents !== null) {
    const dollars = (rules.overagePerFileCents / 100).toFixed(2);
    return {
      subject: 'You have used your whole file quota',
      headline: `${used} used this billing period on the ${plan} plan.`,
      detail: `Uploads keep working. Each file beyond ${filesLimit} is billed as overage at $${dollars}.`,
    };
  }

  return {
    subject: 'You have used your whole file quota',
    headline: `${used} used this billing period on the ${plan} plan.`,
    detail:
      upgrade === null
        ? `Uploads stop until ${resetsOn}.`
        : `Uploads stop until ${resetsOn}. Move to the ${upgrade} plan to keep uploading now.`,
  };
}
