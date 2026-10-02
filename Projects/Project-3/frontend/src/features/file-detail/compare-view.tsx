import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Stamp } from "@/components/ui/stamp";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/cn";
import { COLUMN_TYPE_LABEL, count, percent } from "./labels";

type Comparison = components["schemas"]["ComparisonDto"];
type Change = components["schemas"]["CountChangeDto"];

/** What changed between two versions of a file, worked out from their reports alone. */
export function CompareView({ comparison }: { comparison: Comparison }) {
  const nothingElse =
    comparison.columnsAdded.length === 0 &&
    comparison.columnsRemoved.length === 0 &&
    comparison.typeChanges.length === 0 &&
    comparison.nullPercentChanges.length === 0;

  return (
    <div className="flex flex-col gap-8">
      {comparison.schemaChanged ? (
        <p
          role="note"
          className="flex items-start gap-2.5 rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            The columns changed in a way that can break whatever reads this
            file: one was removed, or now holds a different kind of value.
          </span>
        </p>
      ) : (
        <p
          role="note"
          className="flex items-start gap-2.5 rounded-md border border-pass bg-pass-soft p-4 font-medium text-pass"
        >
          <Check
            aria-hidden
            className="mt-0.5 size-5 shrink-0"
            strokeWidth={2.5}
          />
          <span>No column was removed or changed type.</span>
        </p>
      )}

      <section aria-labelledby="totals-heading" className="flex flex-col gap-3">
        <h2 id="totals-heading" className="text-lg font-semibold">
          The totals
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Total label="Rows" change={comparison.rowCount} better="neutral" />
          <Total
            label="Columns"
            change={comparison.columnCount}
            better="neutral"
          />
          <Total
            label="Repeated rows"
            change={comparison.duplicateRows}
            better="lower"
          />
          <Total
            label="Quality score"
            change={comparison.qualityScore}
            better="higher"
          />
        </dl>
      </section>

      <section
        aria-labelledby="columns-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="columns-heading" className="text-lg font-semibold">
          The columns
        </h2>
        {nothingElse ? (
          <p className="text-text-muted">
            The same columns hold the same kinds of value, with about as many
            empty cells.
          </p>
        ) : null}

        {comparison.columnsAdded.length > 0 ? (
          <NameList
            title="New columns"
            tone="pass"
            names={comparison.columnsAdded}
          />
        ) : null}
        {comparison.columnsRemoved.length > 0 ? (
          <NameList
            title="Columns that are gone"
            tone="hold"
            names={comparison.columnsRemoved}
          />
        ) : null}

        {comparison.typeChanges.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">
              Columns that now hold something different
            </h3>
            <ul className="leaf divide-y divide-line">
              {comparison.typeChanges.map((change) => (
                <li
                  key={change.column}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
                >
                  <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                    {change.column}
                  </span>
                  <span className="flex items-center gap-2 text-text-muted">
                    {COLUMN_TYPE_LABEL[change.from]}
                    <ArrowRight aria-label="became" className="size-4" />
                    {COLUMN_TYPE_LABEL[change.to]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {comparison.nullPercentChanges.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">
              Columns with noticeably more or fewer empty cells
            </h3>
            <div className="leaf overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left">
                <caption className="sr-only">
                  Share of empty cells, before and after
                </caption>
                <thead>
                  <tr className="border-b border-line-strong text-xs font-semibold tracking-[0.06em] text-text-subtle uppercase">
                    <th scope="col" className="px-4 py-2">
                      Column
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Before
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      After
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.nullPercentChanges.map((change) => (
                    <tr
                      key={change.column}
                      className="border-b border-line last:border-b-0"
                    >
                      <td className="px-4 py-2.5 font-semibold [overflow-wrap:anywhere]">
                        {change.column}
                      </td>
                      <td className="num px-4 py-2.5 text-right font-mono text-sm text-text-muted">
                        {percent(change.from)}
                      </td>
                      <td className="num px-4 py-2.5 text-right font-mono text-sm text-text-muted">
                        {percent(change.to)}
                      </td>
                      <td
                        className={cn(
                          "num px-4 py-2.5 text-right font-mono text-sm font-semibold",
                          change.delta > 0 ? "text-hold" : "text-pass",
                        )}
                      >
                        {change.delta > 0 ? "+" : ""}
                        {change.delta.toLocaleString("en-US", {
                          maximumFractionDigits: 1,
                        })}{" "}
                        pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <p className="text-sm text-text-subtle">
        Compared from the stored reports, so nothing was read from the files
        again.{" "}
        <Link
          href={`/files/${comparison.to.fileId}`}
          className="font-semibold text-text underline underline-offset-2"
        >
          Open version {comparison.to.version}
        </Link>
        .
      </p>
    </div>
  );
}

function NameList({
  title,
  tone,
  names,
}: {
  title: string;
  tone: "pass" | "hold";
  names: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      <ul className="flex flex-wrap gap-2">
        {names.map((name) => (
          <li key={name}>
            <Stamp
              tone={tone}
              className="h-auto max-w-full py-0.5 normal-case tracking-normal"
            >
              <span className="[overflow-wrap:anywhere]">{name}</span>
            </Stamp>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One figure, before and after, with how far it moved and whether that is good news. */
function Total({
  label,
  change,
  better,
}: {
  label: string;
  change: Change;
  /** Which way is an improvement; `neutral` when neither is. */
  better: "higher" | "lower" | "neutral";
}) {
  const delta = change.delta;
  const improved =
    delta === null || delta === 0 || better === "neutral"
      ? null
      : delta > 0 === (better === "higher");
  let note: ReactNode = <span className="text-text-subtle">no change</span>;
  if (delta === null) {
    note = <span className="text-text-subtle">not scored on one side</span>;
  } else if (delta !== 0) {
    note = (
      <span
        className={cn(
          "num font-mono font-semibold",
          improved === null
            ? "text-text-muted"
            : improved
              ? "text-pass"
              : "text-hold",
        )}
      >
        {delta > 0 ? "+" : ""}
        {delta.toLocaleString("en-US", { maximumFractionDigits: 1 })}
      </span>
    );
  }
  return (
    <div className="leaf flex flex-col gap-1 p-4">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className="num flex items-center gap-2 font-mono text-xl font-semibold">
          {change.from === null ? "—" : count(change.from)}
          <ArrowRight aria-label="became" className="size-4 text-text-subtle" />
          {change.to === null ? "—" : count(change.to)}
        </span>
        <span className="text-sm">{note}</span>
      </dd>
    </div>
  );
}
