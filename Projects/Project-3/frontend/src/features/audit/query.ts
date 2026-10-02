import { type AuditAction, isAction } from "./actions";

export interface AuditFilters {
  action: AuditAction | undefined;
  actor: string | undefined;
  /** `YYYY-MM-DD`, as typed into the date field. */
  from: string | undefined;
  to: string | undefined;
  cursor: string | undefined;
}

type Raw = Record<string, string | string[] | undefined>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(value: string | string[] | undefined): string | undefined {
  const one = Array.isArray(value) ? value[0] : value;
  return one === "" ? undefined : one;
}

function day(value: string | undefined): string | undefined {
  if (value === undefined || !DAY.test(value)) return undefined;
  return Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
    ? undefined
    : value;
}

/** The filters in the address, each one checked: anything that is not a real value is dropped, never forwarded. */
export function readFilters(raw: Raw): AuditFilters {
  const action = first(raw.action);
  const actor = first(raw.actor);
  return {
    action: isAction(action) ? action : undefined,
    actor: actor !== undefined && UUID.test(actor) ? actor : undefined,
    from: day(first(raw.from)),
    to: day(first(raw.to)),
    cursor: first(raw.cursor),
  };
}

/** The API's `from` is inclusive: the start of that UTC day. */
export function fromTimestamp(value: string | undefined): string | undefined {
  return value === undefined ? undefined : `${value}T00:00:00.000Z`;
}

/** The API's `to` is exclusive, and a person who picks "to Oct 5" means Oct 5 included: the start of the next day. */
export function toTimestamp(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

/** The address of the audit log with these filters (and optionally an older page of them). */
export function auditHref(
  filters: Omit<AuditFilters, "cursor">,
  cursor?: string,
): string {
  const params = new URLSearchParams();
  if (filters.action) params.set("action", filters.action);
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (cursor) params.set("cursor", cursor);
  const text = params.toString();
  return text ? `/audit?${text}` : "/audit";
}
