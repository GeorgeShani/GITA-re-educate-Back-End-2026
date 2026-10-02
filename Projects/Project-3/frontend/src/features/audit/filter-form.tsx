import Link from "next/link";
import { Button } from "@/components/ui/button";
import { inputStyles } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { Person } from "@/lib/session/people";
import { ACTIONS, type AuditAction, GROUPS } from "./actions";
import type { AuditFilters } from "./query";

const FIELD = cn(inputStyles(), "pr-8");

/**
 * The audit log's filters. A plain GET form, so the filtered log is a link that can be bookmarked or sent to a colleague,
 * and it needs no script to work. Dates are UTC days; "to" includes the day you pick.
 */
export function FilterForm({
  filters,
  people,
}: {
  filters: AuditFilters;
  people: readonly Person[];
}) {
  const active = Boolean(
    filters.action || filters.actor || filters.from || filters.to,
  );
  const actions = Object.keys(ACTIONS).filter(
    (name): name is AuditAction => name in ACTIONS,
  );
  return (
    <form
      method="get"
      action="/audit"
      aria-label="Filter the audit log"
      className="leaf grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        What happened
        <select
          name="action"
          defaultValue={filters.action ?? ""}
          className={FIELD}
        >
          <option value="">Anything</option>
          {GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {actions
                .filter((name) => ACTIONS[name].group === group)
                .map((name) => (
                  <option key={name} value={name}>
                    {ACTIONS[name].label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Who did it
        <select
          name="actor"
          defaultValue={filters.actor ?? ""}
          className={FIELD}
        >
          <option value="">Anyone</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.removed ? `${person.name} (removed)` : person.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        From
        <input
          type="date"
          name="from"
          defaultValue={filters.from ?? ""}
          className={inputStyles()}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        To
        <input
          type="date"
          name="to"
          defaultValue={filters.to ?? ""}
          className={inputStyles()}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit" variant="primary">
          Apply filters
        </Button>
        {active ? (
          <Button asChild variant="ghost">
            <Link href="/audit">Clear</Link>
          </Button>
        ) : null}
        <p className="text-sm text-text-muted">Days are UTC.</p>
      </div>
    </form>
  );
}
