import { isRecord } from "@/lib/guards";

/** One inbox entry, as the list needs it. `payload` is whatever the API sent for this `type`; read it with the helpers below. */
export interface NotificationItem {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export function toItem(value: unknown): NotificationItem | null {
  if (!isRecord(value)) return null;
  const { id, type, payload, readAt, createdAt } = value;
  if (
    typeof id !== "string" ||
    typeof type !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }
  return {
    id,
    type,
    payload: isRecord(payload) ? payload : {},
    readAt: typeof readAt === "string" ? readAt : null,
    createdAt,
  };
}

export interface NotificationPage {
  items: NotificationItem[];
  nextCursor: string | null;
}

/** Reads `{ data: [...], meta: { nextCursor, hasMore } }`; `null` when the answer is anything else. */
export function toPage(body: unknown): NotificationPage | null {
  if (!isRecord(body) || !Array.isArray(body.data) || !isRecord(body.meta)) {
    return null;
  }
  const items = body.data.map(toItem);
  if (items.some((item) => item === null)) return null;
  const { nextCursor, hasMore } = body.meta;
  return {
    items: items.filter((item): item is NotificationItem => item !== null),
    nextCursor:
      hasMore === true && typeof nextCursor === "string" ? nextCursor : null,
  };
}

export function text(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

export function number(
  payload: Record<string, unknown>,
  key: string,
): number | null {
  const value = payload[key];
  return typeof value === "number" ? value : null;
}

export function strings(
  payload: Record<string, unknown>,
  key: string,
): string[] {
  const value = payload[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}
