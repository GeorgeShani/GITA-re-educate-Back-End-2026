import "server-only";

/** One entry of `GET /subscriptions/plans`: the public catalog every price and limit on the site comes from. */
export interface Plan {
  plan: "free" | "basic" | "premium";
  maxEmployees: number | null;
  maxSeats: number | null;
  filesPerPeriod: number;
  seatPriceCents: number;
  basePriceCents: number;
  overagePerFileCents: number | null;
  rateLimitPerMinute: number;
  maxQualityRules: number | null;
  maxVersionsPerDataset: number | null;
  questionsPerPeriod: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isPlanName(value: unknown): value is Plan["plan"] {
  return value === "free" || value === "basic" || value === "premium";
}

/** Reads one catalog entry, or `null` when the API sent something this page does not understand. */
function toPlan(value: unknown): Plan | null {
  if (!isRecord(value)) return null;
  const {
    plan,
    maxEmployees,
    maxSeats,
    filesPerPeriod,
    seatPriceCents,
    basePriceCents,
    overagePerFileCents,
    rateLimitPerMinute,
    maxQualityRules,
    maxVersionsPerDataset,
    questionsPerPeriod,
  } = value;
  if (
    !isPlanName(plan) ||
    !isNumberOrNull(maxEmployees) ||
    !isNumberOrNull(maxSeats) ||
    typeof filesPerPeriod !== "number" ||
    typeof seatPriceCents !== "number" ||
    typeof basePriceCents !== "number" ||
    !isNumberOrNull(overagePerFileCents) ||
    typeof rateLimitPerMinute !== "number" ||
    !isNumberOrNull(maxQualityRules) ||
    !isNumberOrNull(maxVersionsPerDataset) ||
    typeof questionsPerPeriod !== "number"
  ) {
    return null;
  }
  return {
    plan,
    maxEmployees,
    maxSeats,
    filesPerPeriod,
    seatPriceCents,
    basePriceCents,
    overagePerFileCents,
    rateLimitPerMinute,
    maxQualityRules,
    maxVersionsPerDataset,
    questionsPerPeriod,
  };
}

const ORDER: Plan["plan"][] = ["free", "basic", "premium"];

/**
 * The plan catalog, fetched on the server and cached for five minutes. Returns `null` when the API cannot be reached or
 * answers something unexpected: the pricing page then says so plainly rather than showing numbers this code invented.
 */
export async function fetchPlans(): Promise<Plan[] | null> {
  const origin = process.env.API_ORIGIN ?? "http://localhost:4000";
  try {
    const response = await fetch(`${origin}/subscriptions/plans`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!Array.isArray(body)) return null;
    const plans = body.map(toPlan);
    const valid = plans.filter((entry): entry is Plan => entry !== null);
    if (valid.length !== plans.length || valid.length === 0) return null;
    return valid.sort((a, b) => ORDER.indexOf(a.plan) - ORDER.indexOf(b.plan));
  } catch {
    return null;
  }
}
