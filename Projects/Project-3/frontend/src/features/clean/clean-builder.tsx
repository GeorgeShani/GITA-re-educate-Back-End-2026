"use client";

import { ArrowRight, LoaderCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, inputStyles, Textarea } from "@/components/ui/field";
import { Stamp } from "@/components/ui/stamp";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import { cn } from "@/lib/cn";
import { visibleSpaces } from "@/lib/format/spaces";
import { type Job, type Preview, toJob, toPreview } from "./api";
import {
  type Draft,
  draft,
  STEP_INFO,
  type StepKind,
  stepInfo,
  toRecipe,
} from "./steps";

const selectStyles = cn(inputStyles(), "pr-8");

export interface ColumnInfo {
  name: string;
  /** What the report found in it: whole numbers, text, ... */
  type: string;
  /** The kind of personal data it looks like, when it does. */
  sensitive: string | null;
}

/**
 * The page where a recipe is built and checked before anything is written. Every change asks the server for a dry run (a
 * preview of exactly what would change, counted over the whole file), so what is shown is what will happen. Creating the
 * version queues it; this page then waits for it and opens the comparison with the file it came from.
 */
export function CleanBuilder({
  fileId,
  columns,
  initial,
  hasSavedRecipe,
  autoCleanOn,
  canAutoClean,
  sheetName,
}: {
  fileId: string;
  columns: readonly ColumnInfo[];
  initial: readonly Draft[];
  hasSavedRecipe: boolean;
  autoCleanOn: boolean;
  /** Automatic cleaning is a paid-plan feature. */
  canAutoClean: boolean;
  sheetName: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Draft[]>([...initial]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewProblem, setPreviewProblem] = useState<string | null>(null);
  const [remember, setRemember] = useState(hasSavedRecipe || autoCleanOn);
  const [auto, setAuto] = useState(autoCleanOn);
  const [creating, setCreating] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const built = toRecipe(items);

  // A dry run after every change, once typing pauses. A slow answer to an older recipe is dropped.
  useEffect(() => {
    const { recipe } = toRecipe(items);
    if (!recipe) {
      setPreview(null);
      setPreviewProblem(null);
      return;
    }
    let stale = false;
    setPreviewing(true);
    const timer = setTimeout(async () => {
      const result = await callApi("POST", `/files/${fileId}/clean/preview`, {
        recipe,
        ...(sheetName ? { sheet: sheetName } : {}),
      });
      if (stale) return;
      const read = succeeded(result) ? toPreview(result.body) : null;
      setPreview(read);
      setPreviewProblem(read ? null : messageFor(result));
      setPreviewing(false);
    }, 600);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [items, fileId, sheetName]);

  // While the new version is being made, ask how it is going.
  useEffect(() => {
    if (!job || job.status === "succeeded" || job.status === "failed") return;
    const timer = setInterval(async () => {
      const result = await callApi(
        "GET",
        `/files/${fileId}/clean/jobs/${job.id}`,
      );
      const next = succeeded(result) ? toJob(result.body) : null;
      if (next) setJob(next);
    }, 1500);
    return () => clearInterval(timer);
  }, [job, fileId]);

  useEffect(() => {
    if (job?.status === "succeeded" && job.resultFileId) {
      router.push(`/files/${fileId}/compare/${job.resultFileId}`);
    }
  }, [job, fileId, router]);

  const change = (id: string, patch: Partial<Draft>) =>
    setItems((now) =>
      now.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const create = async () => {
    if (!built.recipe) return;
    setCreating(true);
    setProblem(null);
    const result = await callApi("POST", `/files/${fileId}/clean`, {
      recipe: built.recipe,
      ...(sheetName ? { sheet: sheetName } : {}),
      saveRecipe: remember,
      autoClean: remember && auto && canAutoClean,
    });
    const started = succeeded(result) ? toJob(result.body) : null;
    if (started) setJob(started);
    else setProblem(messageFor(result));
    setCreating(false);
  };

  const working = job !== null && job.status !== "failed";

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section
          aria-labelledby="steps-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="steps-heading" className="text-xl font-semibold">
            Steps
          </h2>
          <p className="text-sm text-text-muted">
            They run in order, top to bottom. Switch a step off to skip it.
          </p>
          <ol className="flex flex-col gap-3">
            {items.map((item) => (
              <StepCard
                key={item.id}
                item={item}
                columns={columns}
                disabled={working}
                onChange={(patch) => change(item.id, patch)}
                onRemove={() =>
                  setItems((now) => now.filter((entry) => entry.id !== item.id))
                }
              />
            ))}
          </ol>
          <AddStep
            disabled={working}
            onAdd={(kind) => setItems((now) => [...now, draft(kind)])}
          />
        </section>

        <PreviewPanel
          preview={preview}
          previewing={previewing}
          problem={built.problem ?? previewProblem}
        />
      </div>

      <section
        aria-labelledby="create-heading"
        className="leaf flex flex-col gap-4 p-5"
      >
        <h2 id="create-heading" className="text-xl font-semibold">
          Create the cleaned version
        </h2>
        <p className="max-w-prose text-text-muted">
          Your file stays exactly as it is. The cleaned data becomes the next
          version of it, checked by the same rules, and you are shown the two
          side by side.
          {sheetName ? ` Only the sheet “${sheetName}” is carried over.` : ""}
        </p>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-text"
            checked={remember}
            disabled={working}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <span>
            Remember these steps for this file
            <span className="block text-sm text-text-muted">
              They are filled in the next time you clean it.
            </span>
          </span>
        </label>
        <label
          className={cn(
            "flex items-start gap-2",
            !canAutoClean && "opacity-60",
          )}
        >
          <input
            type="checkbox"
            className="mt-1 size-4 accent-text"
            checked={auto && canAutoClean}
            disabled={working || !remember || !canAutoClean}
            onChange={(event) => setAuto(event.target.checked)}
          />
          <span>
            Clean every new version of this file automatically
            <span className="block text-sm text-text-muted">
              {canAutoClean ? (
                "Each upload is kept as it arrived, and a cleaned version follows it."
              ) : (
                <>
                  Automatic cleaning is on the Basic and Premium plans.{" "}
                  <Link
                    href="/billing"
                    className="font-semibold underline underline-offset-2"
                  >
                    See the plans
                  </Link>
                  .
                </>
              )}
            </span>
          </span>
        </label>

        {job ? <JobStatus job={job} /> : null}
        {problem ? (
          <p role="alert" className="font-medium text-hold">
            {problem}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            disabled={!built.recipe || creating || working}
            onClick={() => void create()}
          >
            {creating || working ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <Sparkles aria-hidden />
            )}
            Create cleaned version
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/files/${fileId}`}>Cancel</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function AddStep({
  onAdd,
  disabled,
}: {
  onAdd: (kind: StepKind) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="add-step">
        Add a step
      </label>
      <select
        id="add-step"
        className={cn(selectStyles, "w-auto")}
        value=""
        disabled={disabled}
        onChange={(event) => {
          const kind = STEP_INFO.find(
            (entry) => entry.kind === event.target.value,
          );
          if (kind) onAdd(kind.kind);
        }}
      >
        <option value="">Add a step…</option>
        {STEP_INFO.map((entry) => (
          <option key={entry.kind} value={entry.kind}>
            {entry.label}
          </option>
        ))}
      </select>
      <Plus aria-hidden className="size-4 text-text-muted" />
    </div>
  );
}

function StepCard({
  item,
  columns,
  disabled,
  onChange,
  onRemove,
}: {
  item: Draft;
  columns: readonly ColumnInfo[];
  disabled: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onRemove: () => void;
}) {
  const info = stepInfo(item.kind);
  const picker =
    info.column === "none" ? null : (
      <Field label={info.column === "optional" ? "Column" : "Column"}>
        {(control) => (
          <select
            {...control}
            className={selectStyles}
            value={item.column}
            disabled={disabled}
            onChange={(event) => onChange({ column: event.target.value })}
          >
            <option value="">
              {info.column === "optional" ? "Every column" : "Choose a column…"}
            </option>
            {columns.map((column) => (
              <option key={column.name} value={column.name}>
                {column.name}
              </option>
            ))}
          </select>
        )}
      </Field>
    );
  return (
    <li
      className={cn("leaf flex flex-col gap-3 p-4", !item.on && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-2">
        <label className="flex min-w-0 items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-text"
            checked={item.on}
            disabled={disabled}
            onChange={(event) => onChange({ on: event.target.checked })}
          />
          <span className="min-w-0">
            <span className="block font-semibold">{info.label}</span>
            <span className="block text-sm text-text-muted">{info.help}</span>
          </span>
        </label>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove the step “${info.label}”`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>

      {item.on ? (
        <div className="flex flex-col gap-3">
          {picker}
          {item.kind === "standardise_dates" ? (
            <Field
              label="When a date could be read two ways"
              hint="03/04/2026 is 3 April in most of the world and 4 March in the United States."
            >
              {(control) => (
                <select
                  {...control}
                  className={selectStyles}
                  value={item.order}
                  disabled={disabled}
                  onChange={(event) => onChange({ order: event.target.value })}
                >
                  <option value="dmy">Read the day first (3 April)</option>
                  <option value="mdy">Read the month first (4 March)</option>
                </select>
              )}
            </Field>
          ) : null}
          {item.kind === "parse_numbers" ? (
            <Field label="The decimal mark in this column">
              {(control) => (
                <select
                  {...control}
                  className={selectStyles}
                  value={item.decimal}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({ decimal: event.target.value })
                  }
                >
                  <option value=".">A point, as in 1,234.50</option>
                  <option value=",">A comma, as in 1.234,50</option>
                </select>
              )}
            </Field>
          ) : null}
          {item.kind === "replace_values" ? (
            <>
              <Field
                label="Values to replace"
                hint="One per line. Capitals do not matter."
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={4}
                    value={item.values}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange({ values: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field
                label="Put instead"
                hint="Leave empty to make the cell empty."
              >
                {(control) => (
                  <Input
                    {...control}
                    value={item.value}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange({ value: event.target.value })
                    }
                  />
                )}
              </Field>
            </>
          ) : null}
          {item.kind === "fill_empty" ? (
            <Field label="Fill with">
              {(control) => (
                <Input
                  {...control}
                  value={item.value}
                  disabled={disabled}
                  onChange={(event) => onChange({ value: event.target.value })}
                />
              )}
            </Field>
          ) : null}
          {item.kind === "change_case" ? (
            <Field label="Write it in">
              {(control) => (
                <select
                  {...control}
                  className={selectStyles}
                  value={item.caseMode}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({ caseMode: event.target.value })
                  }
                >
                  <option value="title">Title Case</option>
                  <option value="upper">CAPITALS</option>
                  <option value="lower">lower case</option>
                </select>
              )}
            </Field>
          ) : null}
          {item.kind === "rename_column" ? (
            <Field label="New name">
              {(control) => (
                <Input
                  {...control}
                  value={item.to}
                  disabled={disabled}
                  onChange={(event) => onChange({ to: event.target.value })}
                />
              )}
            </Field>
          ) : null}
          {item.kind === "mask_column" ? (
            <Field label="How">
              {(control) => (
                <select
                  {...control}
                  className={selectStyles}
                  value={item.maskMode}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({ maskMode: event.target.value })
                  }
                >
                  <option value="redact">Hide it completely</option>
                  <option value="last4">
                    Show only the last four characters
                  </option>
                  <option value="hash">
                    Replace with a fingerprint (the same value always gives the
                    same one)
                  </option>
                </select>
              )}
            </Field>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function PreviewPanel({
  preview,
  previewing,
  problem,
}: {
  preview: Preview | null;
  previewing: boolean;
  problem: string | null;
}) {
  return (
    <section
      aria-labelledby="preview-heading"
      aria-busy={previewing}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="preview-heading" className="text-xl font-semibold">
          What would change
        </h2>
        {previewing ? (
          <span className="flex items-center gap-1.5 text-sm text-text-muted">
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
            Checking the whole file…
          </span>
        ) : null}
      </div>

      {problem && !previewing ? (
        <p
          role="note"
          className="rounded-md border border-line-strong bg-sunken p-3 text-text-muted"
        >
          {problem}
        </p>
      ) : null}

      {preview ? (
        <div
          className={cn(
            "flex flex-col gap-4 transition-opacity duration-(--duration-fast)",
            previewing && "opacity-60",
          )}
        >
          <p className="text-lg">
            <span className="num font-mono font-semibold">
              {preview.rowsBefore.toLocaleString("en-US")}
            </span>{" "}
            rows{" "}
            <ArrowRight aria-hidden className="inline size-4 text-text-muted" />{" "}
            <span className="num font-mono font-semibold">
              {preview.rowsAfter.toLocaleString("en-US")}
            </span>{" "}
            rows
          </p>
          <ul className="leaf divide-y divide-line">
            {preview.steps.map((step, index) => (
              <li
                // The same step can appear twice (two columns), so the position is part of its identity.
                key={`${step.step}-${index}`}
                className="flex flex-col gap-1 px-4 py-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{step.label}</span>
                  {step.skipped ? (
                    <Stamp tone="idle">Skipped</Stamp>
                  ) : (
                    <span className="num font-mono font-semibold">
                      {step.changed.toLocaleString("en-US")}
                    </span>
                  )}
                </div>
                {step.skipped ? (
                  <p className="text-sm text-text-muted">{step.skipped}</p>
                ) : null}
                {step.notes.map((note) => (
                  <p key={note} className="text-sm text-caution">
                    {note}
                  </p>
                ))}
              </li>
            ))}
          </ul>

          {preview.samples.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">A look at the rows that change</h3>
              <div className="leaf max-h-96 overflow-auto">
                <table className="w-full min-w-max border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Rows the steps change, with each cell before and after
                  </caption>
                  <thead className="sticky top-0 bg-sunken text-text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Row
                      </th>
                      {preview.columns.map((name) => (
                        <th
                          key={name}
                          scope="col"
                          className="px-3 py-2 font-semibold"
                        >
                          {name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {preview.samples.map((sample) => (
                      <tr key={sample.row}>
                        <th
                          scope="row"
                          className="num px-3 py-2 font-mono text-text-muted"
                        >
                          {sample.row}
                        </th>
                        {sample.cells.map((cell, index) => (
                          <td
                            // The columns are fixed for one preview, so a cell's position is its identity.
                            // biome-ignore lint/suspicious/noArrayIndexKey: see above
                            key={index}
                            className="px-3 py-2 align-top"
                          >
                            {cell.before !== cell.after ? (
                              <span className="flex flex-col">
                                <del className="text-text-subtle">
                                  {cell.before === null
                                    ? "(empty)"
                                    : visibleSpaces(cell.before)}
                                </del>
                                <ins className="font-semibold no-underline">
                                  {cell.after ?? "(empty)"}
                                </ins>
                              </span>
                            ) : (
                              cell.after
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-text-muted">No row changes with these steps.</p>
          )}
        </div>
      ) : previewing || problem ? null : (
        <p className="text-text-muted">
          Switch on a step to see what it would do to the whole file.
        </p>
      )}
    </section>
  );
}

function JobStatus({ job }: { job: Job }) {
  if (job.status === "failed") {
    return (
      <p role="alert" className="font-medium text-hold">
        {job.errorMessage ?? "The cleaned version could not be made."}
      </p>
    );
  }
  return (
    <output className="flex items-center gap-2 font-medium">
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      {job.status === "queued"
        ? "Waiting to start…"
        : job.status === "running"
          ? "Cleaning the file…"
          : "Done. Opening the comparison…"}
    </output>
  );
}
