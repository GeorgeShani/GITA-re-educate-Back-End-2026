"use client";

import {
  Download,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, inputStyles } from "@/components/ui/field";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import { cn } from "@/lib/cn";
import {
  type Builder,
  EMPTY,
  type Fn,
  FUNCTIONS,
  newId,
  OPS,
  type Result,
  toAnswer,
  toCsv,
  toQuery,
  toResult,
} from "./query";
import { type BarDatum, ResultChart } from "./result-chart";

const selectStyles = cn(inputStyles(), "pr-8");

export interface ExploreColumn {
  name: string;
  /** What the report found in it. */
  type: string;
}

const numberFormat = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Ask a file questions. The query is built from plain choices (filter, group, measure) and computed by the server over every
 * row, so the answer is the whole file's, not a sample's. A sentence can fill the builder in: the assistant sees only the
 * question and the column names, plans the query, and the chips below show exactly what it chose, so it can be checked.
 */
export function ExplorePanel({
  fileId,
  columns,
  aiAvailable,
  questionsUsed,
  questionsLimit,
}: {
  fileId: string;
  columns: readonly ExploreColumn[];
  aiAvailable: boolean;
  questionsUsed: number;
  questionsLimit: number;
}) {
  const first = columns[0]?.name ?? "";
  const [builder, setBuilder] = useState<Builder>({
    ...EMPTY,
    measures: [{ id: newId(), fn: "count", column: "" }],
  });
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askProblem, setAskProblem] = useState<string | null>(null);
  const [asked, setAsked] = useState<{ text: string; used: number } | null>(
    null,
  );
  const [used, setUsed] = useState(questionsUsed);
  const [limit, setLimit] = useState(questionsLimit);

  const query = toQuery(builder);
  const key = JSON.stringify(query);

  // The server runs the query after every change, once editing pauses. An answer to an older query is dropped.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the query; the effect re-reads it from there
  useEffect(() => {
    if (!query) {
      setResult(null);
      setProblem(null);
      return;
    }
    let stale = false;
    setRunning(true);
    const timer = setTimeout(async () => {
      const response = await callApi("POST", `/files/${fileId}/explore`, {
        query,
      });
      if (stale) return;
      const read = succeeded(response) ? toResult(response.body) : null;
      if (read) {
        setResult(read);
        setProblem(null);
      } else {
        setProblem(messageFor(response));
      }
      setRunning(false);
    }, 350);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [key, fileId]);

  const patch = (next: Partial<Builder>) =>
    setBuilder((now) => ({ ...now, ...next }));

  const ask = async () => {
    const text = question.trim();
    if (text.length < 3) return;
    setAsking(true);
    setAskProblem(null);
    const response = await callApi("POST", `/files/${fileId}/ask`, {
      question: text,
    });
    const answer = succeeded(response) ? toAnswer(response.body) : null;
    if (answer) {
      if (answer.builder) setBuilder(answer.builder);
      setResult(answer.result);
      setProblem(null);
      setAsked({ text: answer.question, used: answer.questionsUsed });
      setUsed(answer.questionsUsed);
      setLimit(answer.questionsLimit);
    } else {
      setAskProblem(messageFor(response));
    }
    setAsking(false);
  };

  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob([toCsv(result)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "gridline-result.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columnSelect = (
    value: string,
    onChange: (next: string) => void,
    label: string,
  ) => (
    <select
      aria-label={label}
      className={selectStyles}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Choose a column</option>
      {columns.map((column) => (
        <option key={column.name} value={column.name}>
          {column.name}
        </option>
      ))}
    </select>
  );

  const numericColumns = columns.filter(
    (column) => column.type === "integer" || column.type === "number",
  );

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="ask-heading"
        className="leaf flex flex-col gap-3 p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ask-heading" className="text-lg font-semibold">
            Ask in words
          </h2>
          {aiAvailable ? (
            <p className="text-sm text-text-muted">
              <span className="num font-mono font-semibold text-text">
                {numberFormat(Math.max(0, limit - used))}
              </span>{" "}
              of {numberFormat(limit)} questions left this billing period
            </p>
          ) : null}
        </div>
        {aiAvailable ? (
          <>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void ask();
              }}
            >
              <Input
                aria-label="Your question"
                value={question}
                maxLength={500}
                placeholder="Total revenue by region, highest first"
                onChange={(event) => setQuestion(event.target.value)}
              />
              <Button
                variant="primary"
                type="submit"
                disabled={asking || question.trim().length < 3}
              >
                {asking ? (
                  <LoaderCircle aria-hidden className="animate-spin" />
                ) : (
                  <Sparkles aria-hidden />
                )}
                Ask
              </Button>
            </form>
            <p className="text-sm text-text-muted">
              The assistant sees your question and the column names, never the
              rows. It chooses the query below; Gridline runs it on the whole
              file, and you can change it.
            </p>
          </>
        ) : (
          <p className="text-text-muted">
            The assistant is switched off here, so questions in words are not
            available. The builder below works the same way.
          </p>
        )}
        {askProblem ? (
          <p role="alert" className="font-medium text-hold">
            {askProblem}
          </p>
        ) : null}
        {asked ? (
          <output className="text-sm text-text-muted">
            The assistant read “{asked.text}” as the query below.
          </output>
        ) : null}
      </section>

      <section
        aria-labelledby="build-heading"
        className="leaf flex flex-col gap-5 p-5"
      >
        <h2 id="build-heading" className="text-lg font-semibold">
          The query
        </h2>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold uppercase tracking-[0.06em] text-text-subtle">
            Only rows where
          </legend>
          {builder.filters.length === 0 ? (
            <p className="text-text-muted">Every row.</p>
          ) : null}
          {builder.filters.map((filter) => (
            <div
              key={filter.id}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)_auto]"
            >
              {columnSelect(
                filter.column,
                (column) =>
                  patch({
                    filters: builder.filters.map((f) =>
                      f.id === filter.id ? { ...f, column } : f,
                    ),
                  }),
                "Column to filter by",
              )}
              <select
                aria-label="Condition"
                className={selectStyles}
                value={filter.op}
                onChange={(event) => {
                  const op = OPS.find((o) => o.id === event.target.value)?.id;
                  if (!op) return;
                  patch({
                    filters: builder.filters.map((f) =>
                      f.id === filter.id ? { ...f, op } : f,
                    ),
                  });
                }}
              >
                {OPS.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}
              </select>
              {OPS.find((op) => op.id === filter.op)?.needsValue ? (
                <Input
                  aria-label="Value"
                  value={filter.value}
                  maxLength={500}
                  onChange={(event) =>
                    patch({
                      filters: builder.filters.map((f) =>
                        f.id === filter.id
                          ? { ...f, value: event.target.value }
                          : f,
                      ),
                    })
                  }
                />
              ) : (
                <span />
              )}
              <Button
                size="sm"
                aria-label="Remove this condition"
                onClick={() =>
                  patch({
                    filters: builder.filters.filter((f) => f.id !== filter.id),
                  })
                }
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
          {builder.filters.length < 5 ? (
            <Button
              size="sm"
              className="w-fit"
              onClick={() =>
                patch({
                  filters: [
                    ...builder.filters,
                    { id: newId(), column: first, op: "equals", value: "" },
                  ],
                })
              }
            >
              <Plus aria-hidden />
              Add a condition
            </Button>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold uppercase tracking-[0.06em] text-text-subtle">
            Group by
          </legend>
          {builder.groupBy.length === 0 ? (
            <p className="text-text-muted">
              Nothing: one answer for the whole file.
            </p>
          ) : null}
          {builder.groupBy.map((name, at) => (
            // The position is the identity of a group-by slot: two slots can hold the same column while one is changed.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <div key={at} className="flex items-center gap-2">
              {columnSelect(
                name,
                (next) =>
                  patch({
                    groupBy: builder.groupBy.map((g, i) =>
                      i === at ? next : g,
                    ),
                  }),
                `Group by, column ${at + 1}`,
              )}
              <Button
                size="sm"
                aria-label="Remove this grouping"
                onClick={() =>
                  patch({ groupBy: builder.groupBy.filter((_, i) => i !== at) })
                }
              >
                <X aria-hidden />
              </Button>
            </div>
          ))}
          {builder.groupBy.length < 2 ? (
            <Button
              size="sm"
              className="w-fit"
              onClick={() => patch({ groupBy: [...builder.groupBy, first] })}
            >
              <Plus aria-hidden />
              Group by a column
            </Button>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold uppercase tracking-[0.06em] text-text-subtle">
            Work out
          </legend>
          {builder.measures.map((measure) => {
            const needsColumn =
              FUNCTIONS.find((f) => f.id === measure.fn)?.needsColumn ?? false;
            const pool = measure.fn === "distinct" ? columns : numericColumns;
            return (
              <div
                key={measure.id}
                className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]"
              >
                <select
                  aria-label="What to work out"
                  className={selectStyles}
                  value={measure.fn}
                  onChange={(event) => {
                    const fn: Fn | undefined = FUNCTIONS.find(
                      (f) => f.id === event.target.value,
                    )?.id;
                    if (!fn) return;
                    patch({
                      measures: builder.measures.map((m) =>
                        m.id === measure.id ? { ...m, fn } : m,
                      ),
                    });
                  }}
                >
                  {FUNCTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {needsColumn ? (
                  <select
                    aria-label="Column to work out"
                    className={selectStyles}
                    value={measure.column}
                    onChange={(event) =>
                      patch({
                        measures: builder.measures.map((m) =>
                          m.id === measure.id
                            ? { ...m, column: event.target.value }
                            : m,
                        ),
                      })
                    }
                  >
                    <option value="">Choose a column</option>
                    {(pool.length > 0 ? pool : columns).map((column) => (
                      <option key={column.name} value={column.name}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span />
                )}
                <Button
                  size="sm"
                  aria-label="Remove this measure"
                  disabled={builder.measures.length === 1}
                  onClick={() =>
                    patch({
                      measures: builder.measures.filter(
                        (m) => m.id !== measure.id,
                      ),
                    })
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            );
          })}
          {builder.measures.length < 4 ? (
            <Button
              size="sm"
              className="w-fit"
              onClick={() =>
                patch({
                  measures: [
                    ...builder.measures,
                    { id: newId(), fn: "sum", column: "" },
                  ],
                })
              }
            >
              <Plus aria-hidden />
              Work out another
            </Button>
          ) : null}
        </fieldset>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm">
            Order
            <select
              className={cn(selectStyles, "w-auto")}
              value={
                builder.sort === "auto"
                  ? "auto"
                  : `${builder.sort.by}:${builder.sort.index}`
              }
              onChange={(event) => {
                const [by, index] = event.target.value.split(":");
                patch({
                  sort:
                    (by === "group" || by === "measure") && index !== undefined
                      ? { by, index: Number(index) }
                      : "auto",
                });
              }}
            >
              <option value="auto">Biggest groups first</option>
              {builder.groupBy.map((name, at) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a slot's position is its identity
                <option key={`g${at}`} value={`group:${at}`}>
                  By {name || "the grouping"}
                </option>
              ))}
              {builder.measures.map((measure, at) => (
                <option key={measure.id} value={`measure:${at}`}>
                  By{" "}
                  {FUNCTIONS.find(
                    (f) => f.id === measure.fn,
                  )?.label.toLowerCase()}{" "}
                  {measure.column}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <select
              aria-label="Direction"
              className={cn(selectStyles, "w-auto")}
              value={builder.direction}
              onChange={(event) =>
                patch({
                  direction: event.target.value === "asc" ? "asc" : "desc",
                })
              }
            >
              <option value="desc">Highest first</option>
              <option value="asc">Lowest first</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            Show at most
            <select
              className={cn(selectStyles, "w-auto")}
              value={builder.limit}
              onChange={(event) => patch({ limit: Number(event.target.value) })}
            >
              {[10, 25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n} groups
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="answer-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="answer-heading" className="text-lg font-semibold">
            The answer
          </h2>
          {result && result.rows.length > 0 ? (
            <Button size="sm" onClick={download}>
              <Download aria-hidden />
              Download as CSV
            </Button>
          ) : null}
        </div>
        {problem ? (
          <p
            role="alert"
            className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
          >
            {problem}
          </p>
        ) : null}
        {!query ? (
          <p className="text-text-muted">
            Finish the query above and the answer appears here.
          </p>
        ) : null}
        <div
          aria-busy={running}
          className={cn(
            "flex flex-col gap-4 transition-opacity duration-(--duration-fast)",
            running && "opacity-60",
          )}
        >
          {result ? <Answer result={result} /> : null}
        </div>
      </section>
    </div>
  );
}

function Answer({ result }: { result: Result }) {
  const groups = result.columns.filter((c) => c.kind === "group").length;
  const bars: BarDatum[] =
    groups === 1
      ? result.rows.flatMap((row) => {
          const value = row[1];
          return typeof value === "number"
            ? [{ name: String(row[0] ?? "(empty)"), value }]
            : [];
        })
      : [];
  const measure = result.columns[1]?.name ?? "";

  return (
    <>
      <p className="text-sm text-text-muted">
        <span className="num font-mono font-semibold text-text">
          {numberFormat(result.rowsMatched)}
        </span>{" "}
        of {numberFormat(result.rowsScanned)} rows
        {result.groupCount > result.rows.length
          ? `, ${numberFormat(result.groupCount)} groups, the first ${numberFormat(result.rows.length)} shown`
          : ""}
        .
      </p>
      {result.notes.map((note) => (
        <p key={note} role="note" className="text-sm text-caution">
          {note}
        </p>
      ))}
      {bars.length > 1 ? (
        <div className="leaf p-5">
          <ResultChart data={bars} measure={measure} />
        </div>
      ) : null}
      {result.rows.length === 0 ? (
        <p className="text-text-muted">No row matches.</p>
      ) : (
        <div className="leaf overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-left">
            <caption className="sr-only">The answer</caption>
            <thead>
              <tr className="border-b border-line-strong">
                {result.columns.map((column) => (
                  <th
                    key={column.name}
                    scope="col"
                    className={cn(
                      "p-3 text-sm font-semibold",
                      column.kind === "measure" && "text-right",
                    )}
                  >
                    {column.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.rows.map((row, at) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id; the list is replaced whole
                <tr key={at}>
                  {row.map((cell, index) => (
                    <td
                      // biome-ignore lint/suspicious/noArrayIndexKey: a cell's column is its identity
                      key={index}
                      className={cn(
                        "p-3 [overflow-wrap:anywhere]",
                        result.columns[index]?.kind === "measure" &&
                          "num text-right font-mono",
                      )}
                    >
                      {typeof cell === "number"
                        ? numberFormat(cell)
                        : (cell ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
