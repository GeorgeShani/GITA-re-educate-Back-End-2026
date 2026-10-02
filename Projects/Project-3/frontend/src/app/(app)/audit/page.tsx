import { ChevronRight, ScrollText } from "lucide-react";
import Link from "next/link";
import { AdminsOnly } from "@/components/app/admins-only";
import { Button } from "@/components/ui/button";
import { actionLabel } from "@/features/audit/actions";
import { FilterForm } from "@/features/audit/filter-form";
import {
  auditHref,
  fromTimestamp,
  readFilters,
  toTimestamp,
} from "@/features/audit/query";
import { targetWord } from "@/features/audit/target";
import { exactTime, relativeTime } from "@/lib/format/time";
import { apiClient } from "@/lib/session/api";
import { actorName, loadPeople } from "@/lib/session/people";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Audit log" };

const PER_PAGE = 25;

export default async function Page({ searchParams }: PageProps<"/audit">) {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    return <AdminsOnly what="the audit log" />;
  }
  const filters = readFilters(await searchParams);
  const api = apiClient(session.accessToken);
  const [log, people] = await Promise.all([
    api.GET("/audit", {
      params: {
        query: {
          limit: PER_PAGE,
          ...(filters.action ? { action: filters.action } : {}),
          ...(filters.actor ? { actorUserId: filters.actor } : {}),
          ...(filters.from ? { from: fromTimestamp(filters.from) } : {}),
          ...(filters.to ? { to: toTimestamp(filters.to) } : {}),
          ...(filters.cursor ? { cursor: filters.cursor } : {}),
        },
      },
    }),
    loadPeople(api),
  ]);
  const narrowed = Boolean(
    filters.action || filters.actor || filters.from || filters.to,
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Audit log
        </h1>
        <p className="max-w-prose text-text-muted">
          Everything that changed in your company, who did it and when. Entries
          are written with the change itself and cannot be edited or deleted.
        </p>
      </header>

      <FilterForm filters={filters} people={people} />

      {log.data ? (
        log.data.data.length === 0 ? (
          <div className="leaf flex flex-col items-center gap-3 px-6 py-12 text-center">
            <ScrollText aria-hidden className="size-8 text-text-muted" />
            <p className="headline text-2xl">
              {narrowed ? "Nothing matches" : "Nothing recorded yet"}
            </p>
            <p className="max-w-md text-text-muted">
              {narrowed
                ? "No entry fits these filters. Widen the dates or choose Anything."
                : "Entries appear here as soon as something changes."}
            </p>
          </div>
        ) : (
          <ul aria-label="Audit entries" className="leaf divide-y divide-line">
            {log.data.data.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/audit/${entry.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-sunken"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {actionLabel(entry.action)}
                    </span>
                    <span className="block truncate text-text-muted">
                      {actorName(entry.actorUserId, people)}
                      {entry.targetType
                        ? ` · ${targetWord(entry.targetType)}`
                        : ""}
                    </span>
                  </span>
                  <time
                    dateTime={entry.createdAt}
                    title={exactTime(entry.createdAt)}
                    suppressHydrationWarning
                    className="text-sm text-text-subtle"
                  >
                    {relativeTime(entry.createdAt)}
                  </time>
                  <ChevronRight
                    aria-hidden
                    className="size-4 text-text-subtle"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load the audit log just now. Reload the page in a moment.
        </p>
      )}

      {log.data ? (
        <nav
          aria-label="More entries"
          className="flex items-center justify-between gap-3"
        >
          {filters.cursor ? (
            <Button asChild size="sm">
              <Link href={auditHref(filters)}>Back to the newest</Link>
            </Button>
          ) : (
            <span />
          )}
          {log.data.meta.hasMore && log.data.meta.nextCursor ? (
            <Button asChild size="sm">
              <Link href={auditHref(filters, log.data.meta.nextCursor)}>
                Older entries
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
