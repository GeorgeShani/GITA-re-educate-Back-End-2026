import { createHash } from 'node:crypto';
import { z } from 'zod';

/** A cell, once normalised: what a reader hands the profiler, whatever the file format. */
export type CellValue = string | number | boolean | Date | null;

export const COLUMN_TYPES = ['integer', 'number', 'boolean', 'date', 'string', 'empty'] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

/**
 * How much of a file is profiled. A 25 MB spreadsheet can hold millions of rows; the
 * metrics are computed over the first `MAX_ROWS` and the report says so
 * (`truncated: true`), rather than an upload being able to exhaust the worker's memory.
 */
export const PROFILE_LIMITS = { maxRows: 100_000, maxColumns: 200 } as const;

const columnMetricsSchema = z.object({
  index: z.number().int().nonnegative(),
  name: z.string(),
  nullCount: z.number().int().nonnegative(),
  nullPercent: z.number(),
  inferredType: z.enum(COLUMN_TYPES),
  typeCounts: z.object({
    integer: z.number().int().nonnegative(),
    number: z.number().int().nonnegative(),
    boolean: z.number().int().nonnegative(),
    date: z.number().int().nonnegative(),
    string: z.number().int().nonnegative(),
  }),
  /** More than one kind of value in the column (numbers AND text, say). */
  inconsistent: z.boolean(),
  /** Share of non-empty cells that disagree with the dominant type. */
  inconsistentPercent: z.number(),
  numeric: z.object({ min: z.number(), max: z.number(), mean: z.number() }).nullable(),
});

/**
 * `data_quality_report.metrics` is `jsonb`: read back through this, never trusted.
 * Also the response shape's source of truth.
 */
export const metricsSchema = z.object({
  rowCount: z.number().int().nonnegative(),
  columnCount: z.number().int().nonnegative(),
  emptyRows: z.number().int().nonnegative(),
  duplicateRows: z.number().int().nonnegative(),
  /** Rows with fewer or more cells than the header. */
  raggedRows: z.number().int().nonnegative(),
  /** True when the file had more rows than the profile budget, so the numbers cover a prefix. */
  truncated: z.boolean(),
  rowBudget: z.number().int().positive(),
  headerIssues: z.array(z.string()),
  columns: z.array(columnMetricsSchema),
});
export type DataQualityMetrics = z.infer<typeof metricsSchema>;
export type ColumnMetrics = z.infer<typeof columnMetricsSchema>;

// ---- cell classification ----------------------------------------------------

type CellKind = 'null' | 'integer' | 'number' | 'boolean' | 'date' | 'string';

const INTEGER = /^[+-]?\d+$/;
const DECIMAL = /^[+-]?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** What kind of value a cell holds. Blank and whitespace-only cells are `null`, as in a spreadsheet. */
export function classify(cell: CellValue | undefined): CellKind {
  if (cell === null || cell === undefined) return 'null';
  if (typeof cell === 'boolean') return 'boolean';
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? 'null' : 'date';
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) return 'string';
    return Number.isInteger(cell) ? 'integer' : 'number';
  }

  const text = cell.trim();
  if (text === '') return 'null';
  const lower = text.toLowerCase();
  if (lower === 'true' || lower === 'false') return 'boolean';
  if (INTEGER.test(text)) return 'integer';
  if (DECIMAL.test(text)) return 'number';
  if (ISO_DATE.test(text) && !Number.isNaN(Date.parse(text))) return 'date';
  return 'string';
}

function numericValue(cell: CellValue | undefined, kind: CellKind): number | null {
  if (kind !== 'integer' && kind !== 'number') return null;
  const value = typeof cell === 'number' ? cell : Number(String(cell).trim());
  return Number.isFinite(value) ? value : null;
}

function comparable(cell: CellValue | undefined): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell).trim().slice(0, 200);
}

// ---- the accumulator ----------------------------------------------------------

interface ColumnState {
  name: string;
  nulls: number;
  counts: { integer: number; number: number; boolean: number; date: number; string: number };
  numericCount: number;
  min: number;
  max: number;
  sum: number;
}

/** `name` cleaned up: blanks and duplicates get stable, distinct names, and each fix is reported. */
export function normaliseHeader(raw: readonly CellValue[]): { names: string[]; issues: string[] } {
  const issues: string[] = [];
  const seen = new Map<string, number>();
  const names = raw.map((cell, index) => {
    let name = comparable(cell);
    if (name === '') {
      name = `column_${index + 1}`;
      issues.push(`Column ${index + 1} has no header; it is called "${name}".`);
    }
    const count = (seen.get(name.toLowerCase()) ?? 0) + 1;
    seen.set(name.toLowerCase(), count);
    if (count > 1) {
      const renamed = `${name}_${count}`;
      issues.push(`Header "${name}" appears more than once; the repeat is called "${renamed}".`);
      return renamed;
    }
    return name;
  });
  return { names, issues };
}

/**
 * The deterministic half of a data-quality report. Pure and streaming: feed it the
 * header, then rows one at a time, then `finish()`. It keeps only counters, per-column
 * running statistics, and a set of row fingerprints — memory grows with the row budget,
 * not with the file.
 */
export class MetricsAccumulator {
  private readonly columns: ColumnState[];
  private readonly headerIssues: string[];
  private readonly fingerprints = new Set<string>();
  private rows = 0;
  private emptyRows = 0;
  private duplicateRows = 0;
  private raggedRows = 0;
  private truncated = false;

  constructor(header: readonly CellValue[]) {
    const limited = header.slice(0, PROFILE_LIMITS.maxColumns);
    const { names, issues } = normaliseHeader(limited);
    this.headerIssues = issues;
    if (header.length > PROFILE_LIMITS.maxColumns) {
      this.headerIssues.push(
        `The file has ${header.length} columns; only the first ${PROFILE_LIMITS.maxColumns} were profiled.`,
      );
    }
    this.columns = names.map((name) => ({
      name,
      nulls: 0,
      counts: { integer: 0, number: 0, boolean: 0, date: 0, string: 0 },
      numericCount: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      sum: 0,
    }));
  }

  /** Returns false once the row budget is spent (and marks the profile truncated). */
  addRow(cells: readonly CellValue[]): boolean {
    if (this.rows >= PROFILE_LIMITS.maxRows) {
      this.truncated = true;
      return false;
    }
    this.rows += 1;
    if (cells.length !== this.columns.length) this.raggedRows += 1;

    let anyValue = false;
    const parts: string[] = [];
    this.columns.forEach((column, index) => {
      const cell = cells[index];
      const kind = classify(cell);
      // Length-prefixed, so no cell content can imitate the boundary between two cells.
      const text = comparable(cell);
      parts.push(`${text.length}:${text}`);
      if (kind === 'null') {
        column.nulls += 1;
        return;
      }
      anyValue = true;
      column.counts[kind] += 1;

      const value = numericValue(cell, kind);
      if (value !== null) {
        column.numericCount += 1;
        column.sum += value;
        column.min = Math.min(column.min, value);
        column.max = Math.max(column.max, value);
      }
    });

    if (!anyValue) {
      this.emptyRows += 1;
      return true;
    }
    const fingerprint = createHash('sha1').update(parts.join('\u0001')).digest('base64').slice(0, 16);
    if (this.fingerprints.has(fingerprint)) this.duplicateRows += 1;
    else this.fingerprints.add(fingerprint);
    return true;
  }

  finish(): DataQualityMetrics {
    return {
      rowCount: this.rows,
      columnCount: this.columns.length,
      emptyRows: this.emptyRows,
      duplicateRows: this.duplicateRows,
      raggedRows: this.raggedRows,
      truncated: this.truncated,
      rowBudget: PROFILE_LIMITS.maxRows,
      headerIssues: this.headerIssues,
      columns: this.columns.map((column, index) => this.columnMetrics(column, index)),
    };
  }

  private columnMetrics(column: ColumnState, index: number): ColumnMetrics {
    const { integer, number, boolean, date, string } = column.counts;
    const nonNull = integer + number + boolean + date + string;

    // Integers and decimals are one family: a column of 1, 2, 3.5 is numeric, not inconsistent.
    const families: Array<[Exclude<ColumnType, 'empty'>, number]> = [
      [number > 0 ? 'number' : 'integer', integer + number],
      ['date', date],
      ['boolean', boolean],
      ['string', string],
    ];
    const present = families.filter(([, count]) => count > 0);
    const dominant = present.reduce<[Exclude<ColumnType, 'empty'>, number] | null>(
      (best, entry) => (best === null || entry[1] > best[1] ? entry : best),
      null,
    );

    const total = column.nulls + nonNull;
    const inconsistentCells = dominant ? nonNull - dominant[1] : 0;

    return {
      index,
      name: column.name,
      nullCount: column.nulls,
      nullPercent: percent(column.nulls, total),
      inferredType: dominant ? dominant[0] : 'empty',
      typeCounts: { integer, number, boolean, date, string },
      inconsistent: present.length > 1,
      inconsistentPercent: percent(inconsistentCells, nonNull),
      numeric:
        column.numericCount > 0
          ? { min: column.min, max: column.max, mean: column.sum / column.numericCount }
          : null,
    };
  }
}

/** Two decimal places; 0 for an empty denominator. */
function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 10_000) / 100;
}
