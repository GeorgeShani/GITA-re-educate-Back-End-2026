import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { AdminsOnly } from "@/components/app/admins-only";
import { TickNumber } from "@/components/app/tick-number";
import { WhenSeen } from "@/components/app/when-seen";
import { PLAN_LABEL } from "@/components/marketing/pricing/plan-copy";
import { Stamp } from "@/components/ui/stamp";
import { BurnDownChart } from "@/features/analytics/burn-down-chart";
import { burnRows } from "@/features/analytics/burn-rows";
import {
  ChartCard,
  DataTable,
  LegendKey,
} from "@/features/analytics/chart-card";
import { FilesChart } from "@/features/analytics/files-chart";
import { PeopleChart } from "@/features/analytics/people-chart";
import { queryFor, readRange } from "@/features/analytics/range";
import { RangeFrame } from "@/features/analytics/range-frame";
import { peopleHeight } from "@/features/analytics/scale";
import type { components } from "@/lib/api/schema";
import { formatBytes } from "@/lib/format/bytes";
import { formatCents } from "@/lib/format/money";
import { formatDay, lastDayOf, shortDay } from "@/lib/format/time";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Analytics" };

const MAX_PEOPLE = 10;

export default async function Page({ searchParams }: PageProps<"/analytics">) {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    return <AdminsOnly what="analytics" />;
  }
  const range = readRange((await searchParams).range);
  const bounds = queryFor(range);
  const { data } = await apiClient(session.accessToken).GET(
    "/analytics/usage",
    { params: { query: bounds ?? {} } },
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Analytics
        </h1>
        <p className="max-w-prose text-text-muted">
          How much your company uploads, who uploads it, and how fast this
          period&apos;s quota is going.
        </p>
      </header>

      {data ? (
        <RangeFrame selected={range}>
          <Figures data={data} />
          <FilesPerDay data={data} />
          <Quota data={data} />
          <People data={data} />
          <PlanHistory data={data} />
        </RangeFrame>
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load your analytics just now. Reload the page in a
          moment.
        </p>
      )}
    </div>
  );
}

type AnalyticsData = components["schemas"]["UsageAnalyticsDto"];

function Figures({ data }: { data: AnalyticsData }) {
  const total = data.filesPerDay.reduce((sum, day) => sum + day.files, 0);
  return (
    <section
      aria-label="At a glance"
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
    >
      <Tile label="Files uploaded" note={`in these ${data.range.days} days`}>
        <TickNumber value={total} />
      </Tile>
      <Tile label="Files stored now" note="deleted ones not counted">
        <TickNumber value={data.storage.liveFiles} />
      </Tile>
      <Tile label="Storage in use" note="by those files">
        <TickNumber value={data.storage.liveBytes} kind="bytes" />
      </Tile>
      <Tile label="Uploaded" note="in these days, deleted ones included">
        <TickNumber value={data.storage.uploadedBytesInRange} kind="bytes" />
      </Tile>
    </section>
  );
}

function Tile({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="leaf flex min-w-0 flex-col gap-1.5 p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="text-2xl font-semibold leading-none sm:text-3xl">
        {children}
      </p>
      <p className="text-sm text-text-subtle">{note}</p>
    </div>
  );
}

function FilesPerDay({ data }: { data: AnalyticsData }) {
  const busiest = data.filesPerDay.reduce<
    (typeof data.filesPerDay)[number] | null
  >((best, day) => (day.files > (best?.files ?? 0) ? day : best), null);
  const total = data.filesPerDay.reduce((sum, day) => sum + day.files, 0);
  return (
    <ChartCard
      title="Files per day"
      summary={
        total === 0
          ? "Nothing was uploaded in these days."
          : `${total.toLocaleString("en-US")} ${total === 1 ? "file" : "files"} from ${shortDay(data.range.from)} to ${shortDay(data.filesPerDay.at(-1)?.date ?? data.range.from)}. The busiest day was ${busiest ? shortDay(busiest.date) : ""}, with ${busiest?.files.toLocaleString("en-US")}.`
      }
      table={
        <DataTable
          caption="Files uploaded each day"
          columns={["Day", "Files"]}
          rows={data.filesPerDay.map((day) => [
            shortDay(day.date),
            day.files.toLocaleString("en-US"),
          ])}
        />
      }
    >
      <WhenSeen height={280}>
        <FilesChart data={data.filesPerDay} />
      </WhenSeen>
    </ChartCard>
  );
}

function Quota({ data }: { data: AnalyticsData }) {
  const { quota } = data;
  const share = quota.limit > 0 ? quota.used / quota.limit : 0;
  return (
    <ChartCard
      title="This period's quota"
      summary={
        <>
          <span className="num font-semibold text-text">
            {quota.used.toLocaleString("en-US")}
          </span>{" "}
          of {quota.limit.toLocaleString("en-US")} files used on the{" "}
          {PLAN_LABEL[quota.plan]} plan, {formatDay(quota.periodStart)} to{" "}
          {lastDayOf(quota.periodEnd)}. It resets on{" "}
          {formatDay(quota.periodEnd)}.{" "}
          {share >= 1 ? (
            <Stamp tone="hold">Over the quota</Stamp>
          ) : share >= 0.8 ? (
            <Stamp tone="caution">Nearly used</Stamp>
          ) : (
            <Stamp tone="pass">Within the quota</Stamp>
          )}
        </>
      }
      legend={
        <>
          <LegendKey swatch="var(--color-chart-1)" name="Files used" />
          <LegendKey
            swatch="var(--color-line-strong)"
            name="Where an even pace would be"
          />
        </>
      }
      table={
        <DataTable
          caption="Files used each day against an even pace"
          columns={["Day", "Used", "Even pace"]}
          rows={burnRows(quota).map((row) => [
            shortDay(row.date),
            row.used === undefined ? "–" : row.used.toLocaleString("en-US"),
            row.pace.toLocaleString("en-US"),
          ])}
        />
      }
    >
      <WhenSeen height={300}>
        <BurnDownChart quota={quota} />
      </WhenSeen>
    </ChartCard>
  );
}

function People({ data }: { data: AnalyticsData }) {
  const shown = data.byEmployee.slice(0, MAX_PEOPLE);
  const hidden = data.byEmployee.length - shown.length;
  return (
    <ChartCard
      title="Who uploads"
      summary={
        shown[0]
          ? `${shown[0].fullName} uploaded the most: ${shown[0].files.toLocaleString("en-US")} ${shown[0].files === 1 ? "file" : "files"} (${formatBytes(shown[0].bytes)}).${hidden > 0 ? ` ${hidden} more ${hidden === 1 ? "person" : "people"} are in the table.` : ""}`
          : "Nobody uploaded anything in these days."
      }
      table={
        <DataTable
          caption="Uploads by person"
          columns={["Person", "Files", "Size", "Last upload"]}
          rows={data.byEmployee.map((person) => [
            person.fullName,
            person.files.toLocaleString("en-US"),
            formatBytes(person.bytes),
            formatDay(person.lastUploadAt),
          ])}
        />
      }
    >
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ChartColumn aria-hidden className="size-8 text-text-muted" />
          <p className="text-text-muted">
            Uploads appear here as people make them.
          </p>
        </div>
      ) : (
        <WhenSeen height={peopleHeight(shown.length)}>
          <PeopleChart
            data={shown.map((person) => ({
              name: person.fullName,
              files: person.files,
              bytes: person.bytes,
            }))}
          />
        </WhenSeen>
      )}
    </ChartCard>
  );
}

function PlanHistory({ data }: { data: AnalyticsData }) {
  if (data.planHistory.length === 0) return null;
  return (
    <section className="leaf flex flex-col gap-3 p-5">
      <h2 className="text-xl font-semibold">Plan history</h2>
      <ol className="flex flex-col divide-y divide-line">
        {data.planHistory.map((change) => (
          <li
            key={`${change.effectiveAt}-${change.toPlan}`}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5"
          >
            <span className="w-28 shrink-0 text-text-muted">
              {formatDay(change.effectiveAt)}
            </span>
            <span className="min-w-0 flex-1 font-semibold">
              {change.fromPlan
                ? `${PLAN_LABEL[change.fromPlan]} to ${PLAN_LABEL[change.toPlan]}`
                : `Started on ${PLAN_LABEL[change.toPlan]}`}
            </span>
            {change.invoiceId && change.invoiceTotalCents !== null ? (
              <Link
                href={`/billing/invoices/${change.invoiceId}`}
                className="num text-sm underline underline-offset-2"
              >
                Closing invoice {formatCents(change.invoiceTotalCents)}
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
