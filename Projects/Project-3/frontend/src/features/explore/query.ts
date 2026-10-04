import { isRecord } from "@/lib/guards";

export const OPS = [
  { id: "equals", label: "is", needsValue: true },
  { id: "contains", label: "contains", needsValue: true },
  { id: "greater", label: "is more than", needsValue: true },
  { id: "less", label: "is less than", needsValue: true },
  { id: "empty", label: "is empty", needsValue: false },
  { id: "not_empty", label: "is not empty", needsValue: false },
] as const;
export type Op = (typeof OPS)[number]["id"];

export const FUNCTIONS = [
  { id: "count", label: "Number of rows", needsColumn: false },
  { id: "sum", label: "Total of", needsColumn: true },
  { id: "average", label: "Average of", needsColumn: true },
  { id: "min", label: "Lowest of", needsColumn: true },
  { id: "max", label: "Highest of", needsColumn: true },
  { id: "distinct", label: "Different values in", needsColumn: true },
] as const;
export type Fn = (typeof FUNCTIONS)[number]["id"];

/** One piece of a query as it is edited: every field is text until it is sent. */
export interface FilterDraft {
  id: number;
  column: string;
  op: Op;
  value: string;
}
export interface MeasureDraft {
  id: number;
  fn: Fn;
  column: string;
}

export interface Builder {
  filters: FilterDraft[];
  groupBy: string[];
  measures: MeasureDraft[];
  /** `auto` lets the server order the groups, biggest first. */
  sort: "auto" | { by: "group" | "measure"; index: number };
  direction: "asc" | "desc";
  limit: number;
}

let next = 1;
export const newId = (): number => next++;

export const EMPTY: Builder = {
  filters: [],
  groupBy: [],
  measures: [{ id: 0, fn: "count", column: "" }],
  sort: "auto",
  direction: "desc",
  limit: 50,
};

const needsValue = (op: Op) =>
  OPS.find((entry) => entry.id === op)?.needsValue ?? true;
const needsColumn = (fn: Fn) =>
  FUNCTIONS.find((entry) => entry.id === fn)?.needsColumn ?? false;

/** The query the API takes, or `null` while the builder is not yet a complete question. */
export function toQuery(builder: Builder): Record<string, unknown> | null {
  if (builder.measures.length === 0) return null;
  if (builder.measures.some((m) => needsColumn(m.fn) && m.column === ""))
    return null;
  if (builder.filters.some((f) => f.column === "")) return null;
  if (builder.filters.some((f) => needsValue(f.op) && f.value.trim() === ""))
    return null;
  const sorted =
    builder.sort === "auto" ||
    builder.sort.index >=
      (builder.sort.by === "group"
        ? builder.groupBy.length
        : builder.measures.length)
      ? null
      : builder.sort;
  return {
    filters: builder.filters.map((filter) => {
      if (!needsValue(filter.op)) {
        return { column: filter.column, op: filter.op };
      }
      const asNumber = Number(filter.value);
      const numeric =
        (filter.op === "greater" || filter.op === "less") &&
        filter.value.trim() !== "" &&
        Number.isFinite(asNumber);
      return {
        column: filter.column,
        op: filter.op,
        value: numeric ? asNumber : filter.value,
      };
    }),
    groupBy: builder.groupBy,
    measures: builder.measures.map((m) =>
      needsColumn(m.fn) ? { fn: m.fn, column: m.column } : { fn: m.fn },
    ),
    ...(sorted ? { sort: { ...sorted, direction: builder.direction } } : {}),
    limit: builder.limit,
  };
}

const isOp = (value: unknown): value is Op =>
  OPS.some((entry) => entry.id === value);
const isFn = (value: unknown): value is Fn =>
  FUNCTIONS.some((entry) => entry.id === value);

/** A query the assistant planned, put back into the builder so the person can see it as chips and change it. */
export function builderFromSpec(spec: unknown): Builder | null {
  if (!isRecord(spec)) return null;
  const filters = Array.isArray(spec.filters)
    ? spec.filters.flatMap((entry): FilterDraft[] => {
        if (!isRecord(entry) || typeof entry.column !== "string") return [];
        if (!isOp(entry.op)) return [];
        const { value } = entry;
        return [
          {
            id: newId(),
            column: entry.column,
            op: entry.op,
            value:
              typeof value === "string" || typeof value === "number"
                ? String(value)
                : "",
          },
        ];
      })
    : [];
  const groupBy = Array.isArray(spec.groupBy)
    ? spec.groupBy.filter((name): name is string => typeof name === "string")
    : [];
  const measures = Array.isArray(spec.measures)
    ? spec.measures.flatMap((entry): MeasureDraft[] => {
        if (!isRecord(entry) || !isFn(entry.fn)) return [];
        return [
          {
            id: newId(),
            fn: entry.fn,
            column: typeof entry.column === "string" ? entry.column : "",
          },
        ];
      })
    : [];
  if (measures.length === 0) return null;
  const sort = spec.sort;
  const sorted =
    isRecord(sort) &&
    (sort.by === "group" || sort.by === "measure") &&
    typeof sort.index === "number"
      ? ({ by: sort.by, index: sort.index } as const)
      : "auto";
  return {
    filters,
    groupBy,
    measures,
    sort: sorted,
    direction: isRecord(sort) && sort.direction === "asc" ? "asc" : "desc",
    limit: typeof spec.limit === "number" ? spec.limit : 50,
  };
}

export type Cell = string | number | null;

export interface Result {
  columns: { name: string; kind: "group" | "measure" }[];
  rows: Cell[][];
  rowsMatched: number;
  rowsScanned: number;
  groupCount: number;
  notes: string[];
}

const isCell = (value: unknown): value is Cell =>
  value === null || typeof value === "string" || typeof value === "number";

export function toResult(body: unknown): Result | null {
  if (!isRecord(body)) return null;
  const { columns, rows, rowsMatched, rowsScanned, groupCount, notes } = body;
  if (
    !Array.isArray(columns) ||
    !Array.isArray(rows) ||
    typeof rowsMatched !== "number" ||
    typeof rowsScanned !== "number" ||
    typeof groupCount !== "number"
  ) {
    return null;
  }
  const readColumns = columns.flatMap((column): Result["columns"] => {
    if (!isRecord(column) || typeof column.name !== "string") return [];
    if (column.kind === "group") return [{ name: column.name, kind: "group" }];
    if (column.kind === "measure") {
      return [{ name: column.name, kind: "measure" }];
    }
    return [];
  });
  const readRows = rows.flatMap((row) =>
    Array.isArray(row) && row.every(isCell) ? [row] : [],
  );
  return {
    columns: readColumns,
    rows: readRows,
    rowsMatched,
    rowsScanned,
    groupCount,
    notes: Array.isArray(notes)
      ? notes.filter((note): note is string => typeof note === "string")
      : [],
  };
}

export interface Answer {
  question: string;
  builder: Builder | null;
  result: Result;
  questionsUsed: number;
  questionsLimit: number;
}

export function toAnswer(body: unknown): Answer | null {
  if (!isRecord(body)) return null;
  const result = toResult(body.result);
  if (
    !result ||
    typeof body.question !== "string" ||
    typeof body.questionsUsed !== "number" ||
    typeof body.questionsLimit !== "number"
  ) {
    return null;
  }
  return {
    question: body.question,
    builder: builderFromSpec(body.spec),
    result,
    questionsUsed: body.questionsUsed,
    questionsLimit: body.questionsLimit,
  };
}

const quote = (cell: Cell): string => {
  const text = cell === null ? "" : String(cell);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** The result as a CSV, as it is shown, ready for a spreadsheet (with a byte-order mark so Excel reads it as UTF-8). */
export function toCsv(result: Result): string {
  const lines = [
    result.columns.map((column) => quote(column.name)).join(","),
    ...result.rows.map((row) => row.map(quote).join(",")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
