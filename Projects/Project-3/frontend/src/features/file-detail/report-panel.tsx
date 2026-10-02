import { ListChecks, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Stamp } from "@/components/ui/stamp";
import { ReportStamp, scoreTone } from "@/features/files/report-stamp";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format/time";
import { RebuildButton } from "./actions";
import { COLUMN_TYPE_LABEL, count, percent, statistic } from "./labels";
import { LiveRefresh } from "./live-refresh";

type Report = components["schemas"]["ReportDto"];
type RuleResult = components["schemas"]["RuleResultDto"];
type Metrics = components["schemas"]["MetricsDto"];

/**
 * The report for one file: how it did against the company's rules, what Gridline found in it, and a plain-language
 * summary. A report that is still being built says so and redraws itself when it finishes.
 */
export function ReportPanel({
  fileId,
  report,
  canManage,
  isAdmin,
}: {
  fileId: string;
  report: Report;
  canManage: boolean;
  isAdmin: boolean;
}) {
  const building = report.status === "queued" || report.status === "profiling";
  return (
    <div className="flex flex-col gap-8">
      {building ? <LiveRefresh fileId={fileId} /> : null}

      <section
        aria-label="Quality score"
        className="leaf flex flex-wrap items-center justify-between gap-4 p-5"
      >
        <div className="flex items-center gap-5">
          <Score report={report} />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{headline(report)}</p>
            <p className="text-sm text-text-muted">{subline(report)}</p>
          </div>
        </div>
        {canManage && !building ? <RebuildButton fileId={fileId} /> : null}
      </section>

      {report.status === "ready" && report.narrative ? (
        <Narrative narrative={report.narrative} />
      ) : null}

      {report.status === "failed" || report.status === "unsupported" ? (
        <output className="block rounded-md border border-line-strong bg-sunken p-4 text-text-muted">
          {report.errorMessage ??
            "Gridline could not build a report for this file."}
        </output>
      ) : null}

      {report.status === "ready" ? (
        <RuleResults results={report.ruleResults} isAdmin={isAdmin} />
      ) : null}

      {report.status === "ready" && report.metrics ? (
        <MetricsSection metrics={report.metrics} />
      ) : null}
    </div>
  );
}

function Score({ report }: { report: Report }) {
  if (report.status === "ready" && report.qualityScore !== null) {
    const tone = scoreTone(report.qualityScore);
    return (
      <div
        className={cn(
          "flex size-20 shrink-0 flex-col items-center justify-center rounded-md border-2",
          tone === "pass" && "border-pass bg-pass-soft text-pass",
          tone === "caution" && "border-caution bg-caution-soft text-caution",
          tone === "hold" && "border-hold bg-hold-soft text-hold",
        )}
      >
        <span className="num font-mono text-3xl leading-none font-semibold">
          {report.qualityScore}
        </span>
        <span className="mt-1 text-[0.65rem] font-semibold tracking-[0.08em] uppercase">
          out of 100
        </span>
      </div>
    );
  }
  return <ReportStamp status={report.status} score={null} />;
}

function headline(report: Report): string {
  switch (report.status) {
    case "queued":
      return "Waiting to be checked";
    case "profiling":
      return "Checking this file now";
    case "failed":
      return "The check did not finish";
    case "unsupported":
      return "This file could not be read";
    case "ready":
      if (report.qualityScore === null) {
        return report.ruleResults === null
          ? "Checked, with no rules to score it against"
          : "Checked, but no rule applied to it";
      }
      if (report.qualityScore >= 80) return "This file looks healthy";
      if (report.qualityScore >= 50) return "This file needs a look";
      return "This file has problems";
  }
}

function subline(report: Report): string {
  if (report.status === "queued" || report.status === "profiling") {
    return "This page updates by itself when the report is ready.";
  }
  if (report.status === "ready" && report.profiledAt) {
    return `Checked ${relativeTime(report.profiledAt)}.`;
  }
  return "";
}

function Narrative({
  narrative,
}: {
  narrative: NonNullable<Report["narrative"]>;
}) {
  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-3">
      <h2
        id="summary-heading"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <Sparkles aria-hidden className="size-4" />
        In plain words
      </h2>
      <p className="max-w-prose text-md leading-relaxed">{narrative.summary}</p>
      {narrative.recommendations.length > 0 ? (
        <ul className="flex max-w-prose flex-col gap-1.5 pl-5">
          {narrative.recommendations.map((line) => (
            <li
              key={line}
              className="list-disc leading-relaxed marker:text-text-subtle"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-text-subtle">
        Written by {narrative.model}. It can be wrong, so check the numbers
        below.
      </p>
    </section>
  );
}

function RuleResults({
  results,
  isAdmin,
}: {
  results: readonly RuleResult[] | null;
  isAdmin: boolean;
}) {
  return (
    <section aria-labelledby="rules-heading" className="flex flex-col gap-3">
      <h2
        id="rules-heading"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <ListChecks aria-hidden className="size-4" />
        Quality rules
      </h2>
      {results === null || results.length === 0 ? (
        <p className="max-w-prose text-text-muted">
          Your company has no quality rules yet, so this file has no score.{" "}
          {isAdmin ? (
            <Link
              href="/quality-rules"
              className="font-semibold text-text underline underline-offset-2"
            >
              Add a rule
            </Link>
          ) : (
            "Ask an admin to add rules."
          )}
        </p>
      ) : (
        <>
          <ul className="leaf divide-y divide-line">
            {results.map((result) => (
              <li
                key={result.ruleId}
                className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start"
              >
                <div className="flex">
                  <ResultStamp result={result} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{result.name}</p>
                  <p className="text-sm text-text-muted">{result.message}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-sm text-text-subtle">
            These are the rules as they were when this report was built. Use
            “Check again” to test the file against today&apos;s rules.
          </p>
        </>
      )}
    </section>
  );
}

function ResultStamp({ result }: { result: RuleResult }) {
  if (result.status === "passed") return <Stamp tone="pass">Passed</Stamp>;
  if (result.status === "skipped") return <Stamp tone="idle">Skipped</Stamp>;
  return result.severity === "error" ? (
    <Stamp tone="hold">Failed</Stamp>
  ) : (
    <Stamp tone="caution">Warning</Stamp>
  );
}

function MetricsSection({ metrics }: { metrics: Metrics }) {
  const stats: { label: string; value: number; bad?: boolean }[] = [
    { label: "Rows", value: metrics.rowCount },
    { label: "Columns", value: metrics.columnCount },
    {
      label: "Empty rows",
      value: metrics.emptyRows,
      bad: metrics.emptyRows > 0,
    },
    {
      label: "Repeated rows",
      value: metrics.duplicateRows,
      bad: metrics.duplicateRows > 0,
    },
    {
      label: "Uneven rows",
      value: metrics.raggedRows,
      bad: metrics.raggedRows > 0,
    },
  ];
  return (
    <section aria-labelledby="found-heading" className="flex flex-col gap-4">
      <h2 id="found-heading" className="text-lg font-semibold">
        What is in the file
      </h2>

      {metrics.truncated ? (
        <p
          role="note"
          className="rounded-md border border-caution bg-caution-soft p-3 text-sm text-caution"
        >
          This file is large, so these numbers describe its first{" "}
          <span className="num font-mono">{count(metrics.rowBudget)}</span>{" "}
          rows.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="leaf flex flex-col gap-0.5 p-3">
            <dt className="text-sm text-text-muted">{stat.label}</dt>
            <dd
              className={cn(
                "num font-mono text-2xl font-semibold",
                stat.bad && "text-hold",
              )}
            >
              {count(stat.value)}
            </dd>
          </div>
        ))}
      </dl>

      {metrics.headerIssues.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="font-semibold">Problems with the header row</h3>
          <ul className="flex flex-col gap-1 pl-5">
            {metrics.headerIssues.map((issue) => (
              <li key={issue} className="list-disc text-text-muted">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="leaf overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <caption className="sr-only">
            Every column of the file and what Gridline found in it
          </caption>
          <thead>
            <tr className="border-b border-line-strong text-xs font-semibold tracking-[0.06em] text-text-subtle uppercase">
              <Th>Column</Th>
              <Th>Holds</Th>
              <Th align="right">Empty</Th>
              <Th align="right">Mixed</Th>
              <Th align="right">Lowest</Th>
              <Th align="right">Highest</Th>
              <Th align="right">Average</Th>
            </tr>
          </thead>
          <tbody>
            {metrics.columns.map((column) => (
              <tr
                key={column.index}
                className="border-b border-line last:border-b-0"
              >
                <td
                  className="max-w-56 truncate px-4 py-2.5 font-semibold"
                  title={column.name}
                >
                  {column.name || (
                    <span className="text-text-subtle">(no name)</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-text-muted">
                  {COLUMN_TYPE_LABEL[column.inferredType]}
                </td>
                <Num bad={column.nullPercent > 0}>
                  {percent(column.nullPercent)}
                </Num>
                <Num bad={column.inconsistent}>
                  {column.inconsistent
                    ? percent(column.inconsistentPercent)
                    : "—"}
                </Num>
                <Num>
                  {column.numeric ? statistic(column.numeric.min) : "—"}
                </Num>
                <Num>
                  {column.numeric ? statistic(column.numeric.max) : "—"}
                </Num>
                <Num>
                  {column.numeric ? statistic(column.numeric.mean) : "—"}
                </Num>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-text-subtle">
        “Empty” is the share of cells with nothing in them. “Mixed” is the share
        of cells that do not match what the rest of the column holds, such as
        text among numbers.
      </p>
    </section>
  );
}

function Th({ children, align }: { children: ReactNode; align?: "right" }) {
  return (
    <th
      scope="col"
      className={cn("px-4 py-2", align === "right" && "text-right")}
    >
      {children}
    </th>
  );
}

function Num({ children, bad }: { children: ReactNode; bad?: boolean }) {
  return (
    <td
      className={cn(
        "num px-4 py-2.5 text-right font-mono text-sm",
        bad ? "font-semibold text-hold" : "text-text-muted",
      )}
    >
      {children}
    </td>
  );
}
