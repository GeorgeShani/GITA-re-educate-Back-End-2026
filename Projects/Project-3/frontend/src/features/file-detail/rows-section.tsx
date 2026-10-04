"use client";

import { Download, LoaderCircle, Rows3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/cn";
import { count } from "./labels";

type RowDiff = components["schemas"]["RowDiffDto"];
type Entry = RowDiff["sample"][number];
type Filter = "all" | Entry["change"];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "added", label: "Added" },
  { id: "removed", label: "Removed" },
  { id: "changed", label: "Changed" },
];

/**
 * The rows that changed between two versions. The person picks the columns that identify a row (the suggestion is already
 * ticked), the server compares every row in the background, and this page refreshes until it is ready. The server component
 * above supplies the current state; this one only asks for a new comparison and waits.
 */
export function RowsSection({
  fileId,
  otherId,
  datasetId,
  diff,
  columns,
  canSaveKeys,
}: {
  fileId: string;
  otherId: string;
  datasetId: string;
  diff: RowDiff;
  /** The columns of the newer version, for the key picker. */
  columns: readonly string[];
  canSaveKeys: boolean;
}) {
  const router = useRouter();
  const first =
    diff.keyColumns.length > 0 ? diff.keyColumns : diff.suggestedKeyColumns;
  const [keys, setKeys] = useState<string[]>([...first]);
  const [remember, setRemember] = useState(canSaveKeys);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const working = diff.status === "queued" || diff.status === "running";
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => router.refresh(), 1500);
    return () => clearInterval(timer);
  }, [working, router]);

  const toggle = (name: string) =>
    setKeys((now) =>
      now.includes(name) ? now.filter((key) => key !== name) : [...now, name],
    );

  const compare = async () => {
    setAsking(true);
    setProblem(null);
    if (remember && canSaveKeys) {
      await callApi("PUT", `/datasets/${datasetId}/settings`, {
        keyColumns: keys,
      });
    }
    const result = await callApi(
      "POST",
      `/files/${fileId}/compare/${otherId}/rows`,
      { keyColumns: keys },
    );
    if (succeeded(result)) router.refresh();
    else setProblem(messageFor(result));
    setAsking(false);
  };

  const summary = diff.summary;
  const shown =
    filter === "all"
      ? diff.sample
      : diff.sample.filter((entry) => entry.change === filter);

  return (
    <section aria-labelledby="rows-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="rows-heading" className="text-lg font-semibold">
          The rows
        </h2>
        <p className="max-w-prose text-text-muted">
          Choose the column or columns that identify a row, such as a customer
          number, and Gridline lines the two versions up row by row.
        </p>
      </div>

      <fieldset className="leaf flex flex-col gap-3 p-4">
        <legend className="sr-only">Columns that identify a row</legend>
        <ul className="flex flex-wrap gap-2">
          {columns.map((name) => {
            const on = keys.includes(name);
            return (
              <li key={name}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(name)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors duration-(--duration-fast)",
                    on
                      ? "border-ink bg-tag text-on-tag"
                      : "border-line-strong bg-surface text-text-muted hover:bg-sunken hover:text-text",
                  )}
                >
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
        {diff.status === "none" && diff.suggestedKeyColumns.length > 0 ? (
          <p className="text-sm text-text-muted">
            “{diff.suggestedKeyColumns.join("”, “")}” looks like it identifies a
            row, so it is ticked.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Button
            variant="primary"
            disabled={asking || working || keys.length === 0}
            onClick={() => void compare()}
          >
            {asking || working ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <Rows3 aria-hidden />
            )}
            {working
              ? "Comparing…"
              : diff.status === "ready" || diff.status === "failed"
                ? "Compare again"
                : "Compare the rows"}
          </Button>
          {canSaveKeys ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Remember these columns for this file, and compare every new
              version automatically
            </label>
          ) : null}
        </div>
        {problem ? (
          <p role="alert" className="font-medium text-hold">
            {problem}
          </p>
        ) : null}
      </fieldset>

      {diff.status === "failed" ? (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          {diff.errorMessage ?? "The rows could not be compared."}
        </p>
      ) : null}

      {summary && diff.status === "ready" ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Added" value={summary.added} tone="pass" />
            <Tile label="Removed" value={summary.removed} tone="hold" />
            <Tile label="Changed" value={summary.changed} tone="caution" />
            <Tile label="Unchanged" value={summary.unchanged} tone="idle" />
          </dl>

          <ul className="flex flex-col gap-1 text-text-muted">
            {summary.unmatchable > 0 ? (
              <li>
                <span className="num font-mono font-semibold text-text">
                  {count(summary.unmatchable)}
                </span>{" "}
                rows could not be matched, because their key is empty or appears
                more than once. Try a column that is different on every row.
              </li>
            ) : null}
            {summary.columnsAdded.length > 0 ? (
              <li>
                Only the newer version has: {summary.columnsAdded.join(", ")}.
              </li>
            ) : null}
            {summary.columnsRemoved.length > 0 ? (
              <li>
                Only the older version has: {summary.columnsRemoved.join(", ")}.
              </li>
            ) : null}
            {summary.columnsChanged.length > 0 ? (
              <li>
                Most changed:{" "}
                {summary.columnsChanged
                  .slice(0, 4)
                  .map((entry) => `${entry.column} (${count(entry.changed)})`)
                  .join(", ")}
                .
              </li>
            ) : null}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <fieldset className="flex w-fit max-w-full overflow-x-auto rounded-md border border-line-strong bg-surface p-0.5">
              <legend className="sr-only">Which rows to show</legend>
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={cn(
                    "shrink-0 rounded-sm px-3.5 py-1.5 text-sm font-semibold transition-colors duration-(--duration-fast)",
                    filter === option.id
                      ? "bg-tag text-on-tag"
                      : "text-text-muted hover:bg-sunken hover:text-text",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </fieldset>
            <Button asChild size="sm">
              <a
                href={`/session/api/files/${fileId}/compare/${otherId}/rows.csv`}
                download
              >
                <Download aria-hidden />
                Download all changes
              </a>
            </Button>
          </div>

          {shown.length === 0 ? (
            <p className="text-text-muted">
              {summary.added + summary.removed + summary.changed === 0
                ? "Every matched row is the same in both versions."
                : "None of these in the first 500 changes."}
            </p>
          ) : (
            <ChangeList entries={shown} keyColumns={summary.keyColumns} />
          )}
          {summary.added + summary.removed + summary.changed >
          diff.sample.length ? (
            <p className="text-sm text-text-muted">
              The first {count(diff.sample.length)} changes are shown. The
              download has all{" "}
              {count(summary.added + summary.removed + summary.changed)}.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pass" | "hold" | "caution" | "idle";
}) {
  return (
    <div className="leaf flex flex-col gap-1 p-4">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className="num font-mono text-2xl font-semibold">
          {count(value)}
        </span>
        {value > 0 && tone !== "idle" ? (
          <Stamp tone={tone}>{label}</Stamp>
        ) : null}
      </dd>
    </div>
  );
}

const TONE: Record<Entry["change"], "pass" | "hold" | "caution"> = {
  added: "pass",
  removed: "hold",
  changed: "caution",
};

/** The changes, one card each: what kind, which row, and each cell that moved with the old value struck through. */
function ChangeList({
  entries,
  keyColumns,
}: {
  entries: readonly Entry[];
  keyColumns: readonly string[];
}) {
  return (
    <ul className="leaf divide-y divide-line">
      {entries.map((entry, index) => (
        <li
          // The same key can appear as removed and added in one list.
          key={`${entry.change}:${entry.key.join("\u0000")}:${index}`}
          className="flex flex-col gap-2 px-4 py-3"
        >
          <p className="flex flex-wrap items-center gap-2">
            <Stamp tone={TONE[entry.change]}>{entry.change}</Stamp>
            <span className="font-semibold [overflow-wrap:anywhere]">
              {keyColumns.map((name, at) => (
                <span key={name} className="mr-3">
                  <span className="text-text-muted">{name} </span>
                  <span className="num font-mono">{entry.key[at]}</span>
                </span>
              ))}
            </span>
          </p>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {entry.cells.map((cell) => (
              <div key={cell.column} className="flex min-w-0 flex-col">
                <dt className="text-xs uppercase tracking-[0.06em] text-text-subtle">
                  {cell.column}
                </dt>
                <dd className="[overflow-wrap:anywhere]">
                  {entry.change === "changed" ? (
                    <>
                      <del className="text-text-subtle">
                        {cell.before ?? "empty"}
                      </del>{" "}
                      <span className="font-semibold">
                        {cell.after ?? "empty"}
                      </span>
                    </>
                  ) : entry.change === "removed" ? (
                    <del className="text-text-subtle">
                      {cell.before ?? "empty"}
                    </del>
                  ) : (
                    <span>{cell.after ?? "empty"}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
