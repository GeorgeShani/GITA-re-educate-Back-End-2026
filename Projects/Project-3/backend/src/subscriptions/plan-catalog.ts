export const PLANS = ['free', 'basic', 'premium'] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanRules {
  /**
   * Employees the plan allows. `seats = admin + employees` throughout (decision
   * D2), so a company's seat cap is this + 1. `null` means unlimited.
   */
  maxEmployees: number | null;
  /** Files a billing period may upload before the plan's over-quota rule applies. */
  filesPerPeriod: number;
  /** Per employee per full period, prorated by active days. */
  seatPriceCents: number;
  /** Flat charge per full period. */
  basePriceCents: number;
  /**
   * Per file beyond `filesPerPeriod`. `null` = the plan hard-blocks instead of
   * charging (Free and Basic answer 402; only Premium accepts and bills).
   */
  overagePerFileCents: number | null;
  /**
   * Requests per minute the whole company may make (all its users and API keys share
   * the one budget). The infrastructure limit IS the product limit: a higher plan buys
   * more of it, rather than a generic throttle being bolted on beside the plans.
   */
  rateLimitPerMinute: number;
}

/**
 * Every number the brief specifies, in one typed constant — not a table. The
 * rejected reading of "Basic: 0 to 10 users" (10 seats *including* the admin,
 * max $45) is a one-line change to `basic.maxEmployees`; see decision D2 in
 * SCOPE.md.
 */
export const PLAN_CATALOG: Readonly<Record<Plan, PlanRules>> = {
  free: {
    maxEmployees: 0,
    filesPerPeriod: 10,
    seatPriceCents: 0,
    basePriceCents: 0,
    overagePerFileCents: null,
    rateLimitPerMinute: 30,
  },
  basic: {
    maxEmployees: 10,
    filesPerPeriod: 100,
    seatPriceCents: 500,
    basePriceCents: 0,
    overagePerFileCents: null,
    rateLimitPerMinute: 120,
  },
  premium: {
    maxEmployees: null,
    filesPerPeriod: 1000,
    seatPriceCents: 0,
    basePriceCents: 30_000,
    overagePerFileCents: 50,
    rateLimitPerMinute: 600,
  },
};

/** Seats a plan allows (the admin plus its employees); `null` = unlimited. */
export function maxSeats(plan: Plan): number | null {
  const { maxEmployees } = PLAN_CATALOG[plan];
  return maxEmployees === null ? null : maxEmployees + 1;
}
