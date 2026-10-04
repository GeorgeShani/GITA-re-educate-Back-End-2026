import { isRecord } from "@/lib/guards";

/** What one step did, as the preview and the finished job report it. */
export interface StepOutcome {
  step: string;
  label: string;
  changed: number;
  skipped: string | null;
  notes: string[];
}

export interface Sample {
  row: number;
  cells: { before: string | null; after: string | null }[];
}

export interface Preview {
  rowsBefore: number;
  rowsAfter: number;
  columns: string[];
  steps: StepOutcome[];
  samples: Sample[];
}

const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

function toOutcome(value: unknown): StepOutcome | null {
  if (!isRecord(value)) return null;
  const { step, label, changed, skipped, notes } = value;
  if (
    typeof step !== "string" ||
    typeof label !== "string" ||
    typeof changed !== "number"
  ) {
    return null;
  }
  return {
    step,
    label,
    changed,
    skipped: text(skipped),
    notes: Array.isArray(notes)
      ? notes.filter((note): note is string => typeof note === "string")
      : [],
  };
}

function toSample(value: unknown): Sample | null {
  if (!isRecord(value) || typeof value.row !== "number") return null;
  if (!Array.isArray(value.cells)) return null;
  return {
    row: value.row,
    cells: value.cells.map((cell) =>
      isRecord(cell)
        ? { before: text(cell.before), after: text(cell.after) }
        : { before: null, after: null },
    ),
  };
}

function outcomes(value: unknown): StepOutcome[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const outcome = toOutcome(entry);
        return outcome ? [outcome] : [];
      })
    : [];
}

/** The dry run's answer, read without trusting its shape. */
export function toPreview(body: unknown): Preview | null {
  if (!isRecord(body)) return null;
  const { rowsBefore, rowsAfter, columns, samples } = body;
  if (typeof rowsBefore !== "number" || typeof rowsAfter !== "number") {
    return null;
  }
  return {
    rowsBefore,
    rowsAfter,
    columns: Array.isArray(columns)
      ? columns.filter((name): name is string => typeof name === "string")
      : [],
    steps: outcomes(body.steps),
    samples: Array.isArray(samples)
      ? samples.flatMap((entry) => {
          const sample = toSample(entry);
          return sample ? [sample] : [];
        })
      : [],
  };
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  /** The new version, once it exists. */
  resultFileId: string | null;
  errorMessage: string | null;
  steps: StepOutcome[];
  rowsBefore: number | null;
  rowsAfter: number | null;
}

function toStatus(value: unknown): JobStatus | null {
  return value === "queued" ||
    value === "running" ||
    value === "succeeded" ||
    value === "failed"
    ? value
    : null;
}

export function toJob(body: unknown): Job | null {
  if (!isRecord(body)) return null;
  const status = toStatus(body.status);
  if (typeof body.id !== "string" || !status) return null;
  return {
    id: body.id,
    status,
    resultFileId: text(body.resultFileId),
    errorMessage: text(body.errorMessage),
    steps: outcomes(body.steps),
    rowsBefore: typeof body.rowsBefore === "number" ? body.rowsBefore : null,
    rowsAfter: typeof body.rowsAfter === "number" ? body.rowsAfter : null,
  };
}
