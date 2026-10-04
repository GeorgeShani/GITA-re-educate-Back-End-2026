import { ChevronRight, FileSpreadsheet, UserPlus } from "lucide-react";
import Link from "next/link";
import { TickNumber } from "@/components/app/tick-number";
import { PLAN_LABEL } from "@/components/marketing/pricing/plan-copy";
import { Button } from "@/components/ui/button";
import { NO_FILTERS } from "@/features/files/filters";
import { loadFiles } from "@/features/files/load";
import { ReportStamp, scoreTone } from "@/features/files/report-stamp";
import type { FileRow } from "@/features/files/types";
import { describe } from "@/features/notifications/describe";
import { toItem } from "@/features/notifications/types";
import { cn } from "@/lib/cn";
import { formatDay, relativeTime } from "@/lib/format/time";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";
import { getSubscription } from "@/lib/session/subscription";

export const metadata = { title: "Dashboard" };

/** Under this a file is worth a second look; the same line the report uses for "needs a look". */
const HEALTHY = 80;

function needsAttention(row: FileRow): boolean {
  if (row.status === "failed") return true;
  return row.status === "ready" && row.score !== null && row.score < HEALTHY;
}

/** The first page of the application: who you are working as, what this period has used, and what to do next. */
export default async function Page() {
  const session = await requireSession();
  const isAdmin = session.user.role === "admin";
  const api = apiClient(session.accessToken);
  const [subscription, page, bill, inbox] = await Promise.all([
    getSubscription(session.accessToken),
    loadFiles(session.accessToken, NO_FILTERS),
    isAdmin ? api.GET("/billing/current") : Promise.resolve(null),
    api.GET("/notifications", { params: { query: { limit: 5 } } }),
  ]);
  const data = subscription.data;
  const firstName =
    session.user.fullName.split(/\s+/)[0] ?? session.user.fullName;

  const rows = page?.rows ?? [];
  const scored = rows.filter((row) => row.score !== null);
  const average =
    scored.length === 0
      ? null
      : Math.round(
          scored.reduce((sum, row) => sum + (row.score ?? 0), 0) /
            scored.length,
        );
  const attention = rows.filter(needsAttention).slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Hello, {firstName}
        </h1>
        <p className="text-text-muted">
          {session.company.name}
          {data ? ` · ${PLAN_LABEL[data.plan]} plan` : ""}
        </p>
      </header>

      {data ? (
        <section
          aria-label="This billing period"
          className={cn(
            "grid grid-cols-2 gap-3 sm:gap-4",
            isAdmin && bill?.data ? "lg:grid-cols-4" : "lg:grid-cols-3",
          )}
        >
          <Figure
            label="Files this period"
            value={<TickNumber value={data.usage.files} />}
            note={`of ${data.limits.filesPerPeriod.toLocaleString("en-US")} included`}
          />
          <Figure
            label="Seats in use"
            value={<TickNumber value={data.usage.seats} />}
            note={
              data.limits.maxSeats === null
                ? "no seat limit"
                : `of ${data.limits.maxSeats.toLocaleString("en-US")}`
            }
          />
          {bill?.data ? (
            <Figure
              label="Bill so far"
              value={<TickNumber value={bill.data.totalCents} kind="cents" />}
              note="if nothing changes"
              href="/billing"
            />
          ) : null}
          <Figure
            label="Period ends"
            value={
              <span className="num font-mono">
                {formatDay(data.nextDueDate)}
              </span>
            }
            note="the next invoice is cut then"
          />
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="quality-heading"
          className="leaf flex flex-col gap-4 p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="quality-heading" className="text-xl font-semibold">
                How your files are doing
              </h2>
              <p className="text-text-muted">
                {average === null
                  ? "No file has a score yet."
                  : `Average score across your ${scored.length} latest scored ${scored.length === 1 ? "file" : "files"}.`}
              </p>
            </div>
            {average !== null ? (
              <span
                className={cn(
                  "num flex size-16 shrink-0 items-center justify-center rounded-md border-2 font-mono text-2xl font-semibold",
                  scoreTone(average) === "pass" &&
                    "border-pass bg-pass-soft text-pass",
                  scoreTone(average) === "caution" &&
                    "border-caution bg-caution-soft text-caution",
                  scoreTone(average) === "hold" &&
                    "border-hold bg-hold-soft text-hold",
                )}
              >
                {average}
              </span>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <p className="text-text-muted">
              Upload a spreadsheet and it is checked within seconds.
            </p>
          ) : attention.length === 0 ? (
            <p className="font-medium text-pass">
              Nothing needs a look. Every checked file passed.
            </p>
          ) : (
            <>
              <h3 className="text-sm font-semibold tracking-[0.06em] text-text-subtle uppercase">
                Needs a look
              </h3>
              <ul className="flex flex-col divide-y divide-line">
                {attention.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/files/${row.id}`}
                      className="flex items-center gap-3 py-2.5 hover:bg-sunken"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {row.name}
                      </span>
                      <ReportStamp status={row.status} score={row.score} />
                      <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-text-subtle"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section
          aria-labelledby="inbox-heading"
          className="leaf flex flex-col gap-3 p-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="inbox-heading" className="text-xl font-semibold">
              Latest news
            </h2>
            <Link
              href="/notifications"
              className="text-sm font-semibold underline underline-offset-2"
            >
              All notifications
            </Link>
          </div>
          {inbox.data && inbox.data.data.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {inbox.data.data.map((entry) => {
                const item = toItem(entry);
                const said = item ? describe(item, new Map()) : null;
                if (!item || !said) return null;
                const body = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block",
                          item.readAt === null && "font-semibold",
                        )}
                      >
                        {said.title}
                      </span>
                      <span className="block text-sm text-text-subtle">
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>
                    {said.href ? (
                      <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-text-subtle"
                      />
                    ) : null}
                  </>
                );
                return (
                  <li key={item.id}>
                    {said.href ? (
                      <Link
                        href={said.href}
                        className="flex items-center gap-3 py-2.5 hover:bg-sunken"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 py-2.5">
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-text-muted">
              Nothing yet. Report results, shares and mentions land here.
            </p>
          )}
        </section>
      </div>

      <section aria-label="Next steps" className="flex flex-wrap gap-3">
        <Button asChild variant="primary" size="lg">
          <Link href="/files">
            <FileSpreadsheet aria-hidden />
            Go to your files
          </Link>
        </Button>
        {isAdmin ? (
          <Button asChild size="lg">
            <Link href="/employees">
              <UserPlus aria-hidden />
              Invite your team
            </Link>
          </Button>
        ) : null}
      </section>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: React.ReactNode;
  note: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className="text-2xl font-semibold sm:text-3xl">{value}</p>
      <p className="text-sm text-text-muted">{note}</p>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="leaf flex min-w-0 flex-col gap-1 p-4 hover:bg-sunken"
    >
      {body}
    </Link>
  ) : (
    <div className="leaf flex min-w-0 flex-col gap-1 p-4">{body}</div>
  );
}
