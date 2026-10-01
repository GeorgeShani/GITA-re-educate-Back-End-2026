/** A plain object with unknown contents: the starting point for reading anything that came over the network. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
