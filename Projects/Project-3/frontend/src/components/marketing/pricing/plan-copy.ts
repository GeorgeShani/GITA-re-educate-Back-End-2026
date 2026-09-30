import type { Plan } from "@/lib/api/plans";
import { formatCents } from "@/lib/format/money";

export const PLAN_LABEL: Record<Plan["plan"], string> = {
  free: "Free",
  basic: "Basic",
  premium: "Premium",
};

/** "Unlimited" for `null`, otherwise the number. */
export function limit(value: number | null): string {
  return value === null ? "Unlimited" : value.toLocaleString("en-US");
}

/** The headline price, said the way the plan bills. */
export function priceLine(plan: Plan): string {
  if (plan.basePriceCents > 0)
    return `${formatCents(plan.basePriceCents)} a month`;
  if (plan.seatPriceCents > 0)
    return `${formatCents(plan.seatPriceCents)} per employee a month`;
  return "$0";
}

/** What happens to a file past the quota. */
export function overageLine(plan: Plan): string {
  if (plan.overagePerFileCents === null)
    return `Uploads stop after ${plan.filesPerPeriod.toLocaleString("en-US")} files`;
  return `${formatCents(plan.overagePerFileCents)} per file over ${plan.filesPerPeriod.toLocaleString("en-US")}`;
}
