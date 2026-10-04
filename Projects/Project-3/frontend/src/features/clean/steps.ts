import { isRecord } from "@/lib/guards";

/**
 * The cleaning steps as the page edits them. This mirrors the API's recipe (`POST /files/{id}/clean`), but holds every
 * field as text while it is being typed, and only becomes the API's shape in `toRecipe`.
 */
export const STEP_KINDS = [
  "trim_whitespace",
  "tidy_headers",
  "drop_empty_rows",
  "drop_duplicate_rows",
  "standardise_dates",
  "parse_numbers",
  "replace_values",
  "fill_empty",
  "change_case",
  "rename_column",
  "drop_column",
  "mask_column",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export interface StepInfo {
  kind: StepKind;
  label: string;
  help: string;
  /** Which fields the step has. */
  column: "none" | "optional" | "required";
}

export const STEP_INFO: readonly StepInfo[] = [
  {
    kind: "trim_whitespace",
    label: "Trim spaces",
    help: "Remove spaces at the start and end of cells, and doubled spaces inside them.",
    column: "optional",
  },
  {
    kind: "tidy_headers",
    label: "Tidy the header row",
    help: "Trim the column names and collapse doubled spaces in them.",
    column: "none",
  },
  {
    kind: "drop_empty_rows",
    label: "Remove empty rows",
    help: "Delete rows with nothing in them.",
    column: "none",
  },
  {
    kind: "drop_duplicate_rows",
    label: "Remove repeated rows",
    help: "Keep the first of every row that appears more than once.",
    column: "none",
  },
  {
    kind: "standardise_dates",
    label: "Write dates as YYYY-MM-DD",
    help: "Turn 25/12/2025, 4 Mar 2026 and the like into one format. Values it cannot read are left alone.",
    column: "required",
  },
  {
    kind: "parse_numbers",
    label: "Read text as numbers",
    help: "Turn “1.234,50 €” into 1234.5. Values it cannot read are left alone.",
    column: "required",
  },
  {
    kind: "replace_values",
    label: "Replace placeholders",
    help: "Swap values like N/A, null or - for nothing, or for a value you choose.",
    column: "optional",
  },
  {
    kind: "fill_empty",
    label: "Fill empty cells",
    help: "Put a value in the cells of one column that have none.",
    column: "required",
  },
  {
    kind: "change_case",
    label: "Change letter case",
    help: "Write a column in capitals, lower case or title case.",
    column: "required",
  },
  {
    kind: "rename_column",
    label: "Rename a column",
    help: "Give a column a new name.",
    column: "required",
  },
  {
    kind: "drop_column",
    label: "Remove a column",
    help: "Leave a column out of the new version.",
    column: "required",
  },
  {
    kind: "mask_column",
    label: "Hide personal data",
    help: "Replace what a column holds with a mask, so the new version can be shared.",
    column: "required",
  },
];

export function stepInfo(kind: StepKind): StepInfo {
  return STEP_INFO.find((entry) => entry.kind === kind) ?? STEP_INFO[0];
}

/** One step being edited: every setting as text, plus whether it is switched on. */
export interface Draft {
  id: string;
  on: boolean;
  kind: StepKind;
  column: string;
  /** standardise_dates: `dmy` or `mdy`. */
  order: string;
  /** parse_numbers: `.` or `,`. */
  decimal: string;
  /** replace_values: the placeholders, one per line. */
  values: string;
  /** replace_values: what to put instead; fill_empty: the value. */
  value: string;
  /** change_case: `upper`, `lower` or `title`. */
  caseMode: string;
  /** rename_column: the new name. */
  to: string;
  /** mask_column: `redact`, `last4` or `hash`. */
  maskMode: string;
}

let counter = 0;

export function draft(kind: StepKind, patch: Partial<Draft> = {}): Draft {
  counter += 1;
  return {
    id: `step-${counter}`,
    on: true,
    kind,
    column: "",
    order: "dmy",
    decimal: ".",
    values: "N/A\nn/a\nnull\n-",
    value: "",
    caseMode: "title",
    to: "",
    maskMode: "redact",
    ...patch,
  };
}

export type Built =
  | { ok: true; step: Record<string, unknown> }
  | { ok: false; why: string };

/** The API's step for a draft, or what is still missing from it. */
export function toStep(item: Draft): Built {
  const info = stepInfo(item.kind);
  const column = item.column.trim();
  if (info.column === "required" && column === "") {
    return { ok: false, why: "Choose a column." };
  }
  const base: Record<string, unknown> = { step: item.kind };
  if (info.column !== "none" && column !== "") base.column = column;
  switch (item.kind) {
    case "standardise_dates":
      base.order = item.order === "mdy" ? "mdy" : "dmy";
      break;
    case "parse_numbers":
      base.decimal = item.decimal === "," ? "," : ".";
      break;
    case "replace_values": {
      const values = item.values
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line !== "");
      if (values.length === 0) {
        return { ok: false, why: "List at least one value to replace." };
      }
      base.values = values;
      base.with = item.value;
      break;
    }
    case "fill_empty":
      if (item.value === "")
        return { ok: false, why: "Say what to fill with." };
      base.value = item.value;
      break;
    case "change_case":
      base.mode =
        item.caseMode === "upper" || item.caseMode === "lower"
          ? item.caseMode
          : "title";
      break;
    case "rename_column":
      if (item.to.trim() === "")
        return { ok: false, why: "Type the new name." };
      base.to = item.to.trim();
      break;
    case "mask_column":
      base.mode =
        item.maskMode === "last4" || item.maskMode === "hash"
          ? item.maskMode
          : "redact";
      break;
    default:
      break;
  }
  return { ok: true, step: base };
}

export interface Built2 {
  /** The recipe to send, or `null` while a switched-on step is still incomplete. */
  recipe: { steps: Record<string, unknown>[] } | null;
  /** Why not, for the first incomplete step. */
  problem: string | null;
}

export function toRecipe(items: readonly Draft[]): Built2 {
  const steps: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!item.on) continue;
    const built = toStep(item);
    if (!built.ok) {
      return {
        recipe: null,
        problem: `${stepInfo(item.kind).label}: ${built.why}`,
      };
    }
    steps.push(built.step);
  }
  if (steps.length === 0) {
    return { recipe: null, problem: "Switch on at least one step." };
  }
  return { recipe: { steps }, problem: null };
}

/** A saved recipe (from the API) back into drafts, so it can be edited. Anything it does not understand is dropped. */
export function draftsFromRecipe(recipe: unknown): Draft[] {
  if (!isRecord(recipe) || !Array.isArray(recipe.steps)) return [];
  const out: Draft[] = [];
  for (const raw of recipe.steps) {
    if (!isRecord(raw)) continue;
    const kind = STEP_KINDS.find((entry) => entry === raw.step);
    if (!kind) continue;
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    out.push(
      draft(kind, {
        column: text(raw.column),
        order: text(raw.order) || "dmy",
        decimal: text(raw.decimal) || ".",
        values: Array.isArray(raw.values)
          ? raw.values
              .filter((v): v is string => typeof v === "string")
              .join("\n")
          : "",
        value: text(raw.with) || text(raw.value),
        caseMode: text(raw.mode) || "title",
        to: text(raw.to),
        maskMode: text(raw.mode) || "redact",
      }),
    );
  }
  return out;
}
