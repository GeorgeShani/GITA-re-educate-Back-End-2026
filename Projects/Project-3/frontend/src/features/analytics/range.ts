export const RANGES = [
  { id: "period", label: "This period" },
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

export function readRange(value: string | string[] | undefined): RangeId {
  const one = Array.isArray(value) ? value[0] : value;
  return RANGES.find((range) => range.id === one)?.id ?? "period";
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The `from` and `to` the API wants for a range, or none for "this period" (its own default). Both are UTC days and `to`
 * is exclusive, so "the last 30 days" is today and the 29 before it, ending tomorrow.
 */
export function queryFor(
  range: RangeId,
  now: Date = new Date(),
): { from: string; to: string } | null {
  if (range === "period") return null;
  const days = Number(range);
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return { from: isoDay(from), to: isoDay(to) };
}
