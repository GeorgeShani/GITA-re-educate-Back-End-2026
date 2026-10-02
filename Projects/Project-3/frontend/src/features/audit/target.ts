const WORDS: Record<string, string> = {
  user: "person",
  api_key: "API key",
  webhook_endpoint: "webhook endpoint",
  webhook_delivery: "webhook delivery",
  quality_rule: "quality rule",
};

/** What an entry acted on, in words a person would use: "person", "API key", "file". */
export function targetWord(type: string | null): string {
  if (type === null) return "";
  return WORDS[type] ?? type.replaceAll("_", " ");
}

/** Where to look at the thing an entry acted on, when the dashboard has a page for it. */
export function targetHref(
  type: string | null,
  id: string | null,
): string | null {
  if (type === null || id === null) return null;
  if (type === "file") return `/files/${id}`;
  if (type === "invoice") return `/billing/invoices/${id}`;
  return null;
}
