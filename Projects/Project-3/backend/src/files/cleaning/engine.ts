import { createHmac } from 'node:crypto';
import type { CellValue } from '../quality/metrics.js';
import { parseDate, parseNumber } from './parsers.js';
import type { Recipe, Step } from './recipe.js';

/** What a step did, in numbers a person can check against the file. */
export interface StepOutcome {
  step: Step['step'];
  /** The step in words: "Trim spaces in Name". */
  label: string;
  /** Cells changed (or rows or columns removed, for the steps that do that). */
  changed: number;
  /** Why nothing was done, when the step did not apply (a column that is not in this file). */
  skipped: string | null;
  /** Things worth saying: "12 dates could not be read and were left as they were". */
  notes: string[];
}

/** One row that changed, side by side: the cell before and after, for the columns that are still in the file. */
export interface ChangedRow {
  /** The row's number in the file you uploaded, counting the header as row 1. */
  row: number;
  cells: Array<{ before: string | null; after: string | null }>;
}

export interface CleaningResult {
  header: string[];
  rows: CellValue[][];
  steps: StepOutcome[];
  rowsBefore: number;
  rowsAfter: number;
  /** The first rows the recipe changed, for the preview. */
  samples: ChangedRow[];
}

export interface CleaningContext {
  /** Keys the `hash` mask, so a fingerprint cannot be rebuilt by hashing guesses. */
  hashKey: Buffer;
  /** How many changed rows to keep for the preview. */
  sampleSize?: number;
}

const key = (name: string): string => name.trim().toLowerCase();

export function cellText(cell: CellValue | undefined): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell);
}

const isBlank = (cell: CellValue | undefined): boolean => cellText(cell).trim() === '';

/** The cell as a person would see it, short enough to put in a preview. */
function shown(cell: CellValue | undefined): string | null {
  if (cell === null || cell === undefined) return null;
  const text = cell instanceof Date ? cell.toISOString().replace(/T00:00:00\.000Z$/, '') : String(cell);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

const titleCase = (text: string): string =>
  text.toLowerCase().replace(/(^|[\s\-'(])(\p{L})/gu, (_, lead: string, letter: string) => lead + letter.toUpperCase());

/**
 * Applies a recipe to a sheet. Pure: the same sheet and recipe always give the same result, nothing is read or written, and the
 * input is never changed. Steps run in order, so "trim, then drop duplicates" finds the rows that differed only by spaces.
 */
export function applyRecipe(
  input: { header: readonly CellValue[]; rows: readonly (readonly CellValue[])[] },
  recipe: Recipe,
  context: CleaningContext,
): CleaningResult {
  let header: string[] = input.header.map((cell) => cellText(cell));
  let rows: CellValue[][] = input.rows.map((row) => [...row]);
  const originalRows = input.rows;
  /** For each current row / column, where it was in the file as uploaded. */
  let rowOrigin: number[] = rows.map((_, index) => index);
  let columnOrigin: number[] = header.map((_, index) => index);
  const steps: StepOutcome[] = [];

  const indexOf = (name: string): number => header.findIndex((candidate) => key(candidate) === key(name));
  const skippedColumn = (step: Step, name: string, label: string): StepOutcome => ({
    step: step.step,
    label,
    changed: 0,
    skipped: `The column "${name}" is not in this file.`,
    notes: [],
  });

  for (const step of recipe.steps) {
    switch (step.step) {
      case 'trim_whitespace': {
        const targets = step.column === undefined ? header.map((_, index) => index) : [indexOf(step.column)];
        const label = step.column === undefined ? 'Trim spaces in every column' : `Trim spaces in ${step.column}`;
        if (targets[0] === -1) {
          steps.push(skippedColumn(step, step.column ?? '', label));
          break;
        }
        let changed = 0;
        for (const row of rows) {
          for (const column of targets) {
            const cell = row[column];
            if (typeof cell !== 'string') continue;
            const next = cell.trim().replace(/[ \t]{2,}/g, ' ');
            if (next !== cell) {
              row[column] = next;
              changed += 1;
            }
          }
        }
        steps.push({ step: step.step, label, changed, skipped: null, notes: [] });
        break;
      }

      case 'tidy_headers': {
        let changed = 0;
        header = header.map((name) => {
          const next = name.trim().replace(/\s{2,}/g, ' ');
          if (next !== name) changed += 1;
          return next;
        });
        steps.push({ step: step.step, label: 'Tidy the header row', changed, skipped: null, notes: [] });
        break;
      }

      case 'drop_empty_rows': {
        const keep = rows.map((row) => !row.every(isBlank));
        const removed = keep.filter((flag) => !flag).length;
        rows = rows.filter((_, index) => keep[index]);
        rowOrigin = rowOrigin.filter((_, index) => keep[index]);
        steps.push({ step: step.step, label: 'Remove empty rows', changed: removed, skipped: null, notes: [] });
        break;
      }

      case 'drop_duplicate_rows': {
        const seen = new Set<string>();
        const keep = rows.map((row) => {
          // Length-prefixed, so one cell's text can never pass for the boundary between two cells.
          const fingerprint = row.map((cell) => `${cellText(cell).trim().length}:${cellText(cell).trim()}`).join('\u0001');
          if (seen.has(fingerprint)) return false;
          seen.add(fingerprint);
          return true;
        });
        const removed = keep.filter((flag) => !flag).length;
        rows = rows.filter((_, index) => keep[index]);
        rowOrigin = rowOrigin.filter((_, index) => keep[index]);
        steps.push({ step: step.step, label: 'Remove repeated rows', changed: removed, skipped: null, notes: [] });
        break;
      }

      case 'standardise_dates': {
        const label = `Write dates in ${step.column} as YYYY-MM-DD`;
        const column = indexOf(step.column);
        if (column === -1) {
          steps.push(skippedColumn(step, step.column, label));
          break;
        }
        let changed = 0;
        let unreadable = 0;
        let ambiguous = 0;
        for (const row of rows) {
          const cell = row[column];
          if (cell === null || cell === undefined || cell instanceof Date || isBlank(cell)) continue;
          if (typeof cell === 'number' || typeof cell === 'boolean') {
            unreadable += 1;
            continue;
          }
          const parsed = parseDate(cell, step.order);
          if (!parsed) {
            unreadable += 1;
            continue;
          }
          if (parsed.ambiguous) ambiguous += 1;
          row[column] = parsed.date;
          changed += 1;
        }
        const notes: string[] = [];
        if (ambiguous > 0) {
          notes.push(
            `${ambiguous} ${ambiguous === 1 ? 'date' : 'dates'} like 03/04/2026 could be read either way; they were read ${step.order === 'dmy' ? 'day first' : 'month first'}.`,
          );
        }
        if (unreadable > 0) {
          notes.push(`${unreadable} ${unreadable === 1 ? 'value' : 'values'} could not be read as a date and were left as they were.`);
        }
        steps.push({ step: step.step, label, changed, skipped: null, notes });
        break;
      }

      case 'parse_numbers': {
        const label = `Read ${step.column} as numbers`;
        const column = indexOf(step.column);
        if (column === -1) {
          steps.push(skippedColumn(step, step.column, label));
          break;
        }
        let changed = 0;
        let unreadable = 0;
        for (const row of rows) {
          const cell = row[column];
          if (typeof cell !== 'string' || isBlank(cell)) continue;
          const value = parseNumber(cell, step.decimal);
          if (value === null) {
            unreadable += 1;
            continue;
          }
          row[column] = value;
          changed += 1;
        }
        const notes =
          unreadable > 0 ? [`${unreadable} ${unreadable === 1 ? 'value' : 'values'} could not be read as a number and were left as they were.`] : [];
        steps.push({ step: step.step, label, changed, skipped: null, notes });
        break;
      }

      case 'replace_values': {
        const targets = step.column === undefined ? header.map((_, index) => index) : [indexOf(step.column)];
        const label = `Replace ${step.values.map((value) => `"${value}"`).join(', ')}${step.column === undefined ? '' : ` in ${step.column}`}`;
        if (targets[0] === -1) {
          steps.push(skippedColumn(step, step.column ?? '', label));
          break;
        }
        const wanted = new Set(step.values.map((value) => value.toLowerCase()));
        let changed = 0;
        for (const row of rows) {
          for (const column of targets) {
            const cell = row[column];
            if (typeof cell === 'string' && wanted.has(cell.trim().toLowerCase())) {
              row[column] = step.with === '' ? null : step.with;
              changed += 1;
            }
          }
        }
        steps.push({ step: step.step, label, changed, skipped: null, notes: [] });
        break;
      }

      case 'fill_empty': {
        const label = `Fill empty cells in ${step.column} with "${step.value}"`;
        const column = indexOf(step.column);
        if (column === -1) {
          steps.push(skippedColumn(step, step.column, label));
          break;
        }
        let changed = 0;
        for (const row of rows) {
          if (isBlank(row[column])) {
            row[column] = step.value;
            changed += 1;
          }
        }
        steps.push({ step: step.step, label, changed, skipped: null, notes: [] });
        break;
      }

      case 'change_case': {
        const label = `Write ${step.column} in ${step.mode === 'upper' ? 'capitals' : step.mode === 'lower' ? 'lower case' : 'title case'}`;
        const column = indexOf(step.column);
        if (column === -1) {
          steps.push(skippedColumn(step, step.column, label));
          break;
        }
        let changed = 0;
        for (const row of rows) {
          const cell = row[column];
          if (typeof cell !== 'string') continue;
          const next = step.mode === 'upper' ? cell.toUpperCase() : step.mode === 'lower' ? cell.toLowerCase() : titleCase(cell);
          if (next !== cell) {
            row[column] = next;
            changed += 1;
          }
        }
        steps.push({ step: step.step, label, changed, skipped: null, notes: [] });
        break;
      }

      case 'rename_column': {
        const label = `Rename ${step.column} to ${step.to}`;
        const column = indexOf(step.column);
        if (column === -1) {
          steps.push(skippedColumn(step, step.column, label));
          break;
        }
        const clash = header.findIndex((candidate, index) => index !== column && key(candidate) === key(step.to));
        if (clash !== -1) {
          steps.push({ step: step.step, label, changed: 0, skipped: `The file already has a column called "${step.to}".`, notes: [] });
          break;
        }
        header[column] = step.to;
        steps.push({ step: step.step, label, changed: 1, skipped: null, notes: [] });
        break;
      }

      case 'drop_column': {
        const label = `Remove the column ${step.column}`;
        const column = indexOf(step.column);
        if (column === -1) {
          steps.push(skippedColumn(step, step.column, label));
          break;
        }
        header = header.filter((_, index) => index !== column);
        columnOrigin = columnOrigin.filter((_, index) => index !== column);
        rows = rows.map((row) => row.filter((_, index) => index !== column));
        steps.push({ step: step.step, label, changed: 1, skipped: null, notes: [] });
        break;
      }

      case 'mask_column': {
        const label = `${step.mode === 'redact' ? 'Hide' : step.mode === 'last4' ? 'Hide all but the last four characters of' : 'Replace with fingerprints'} ${step.column}`;
        const column = indexOf(step.column);
        if (column === -1) {
          steps.push(skippedColumn(step, step.column, label));
          break;
        }
        let changed = 0;
        for (const row of rows) {
          const cell = row[column];
          if (isBlank(cell)) continue;
          const text = cellText(cell).trim();
          row[column] =
            step.mode === 'redact'
              ? '[hidden]'
              : step.mode === 'last4'
                ? text.length <= 4
                  ? '*'.repeat(text.length)
                  : `${'*'.repeat(text.length - 4)}${text.slice(-4)}`
                : createHmac('sha256', context.hashKey).update(text).digest('hex').slice(0, 16);
          changed += 1;
        }
        steps.push({ step: step.step, label, changed, skipped: null, notes: [] });
        break;
      }
    }
  }

  const samples: ChangedRow[] = [];
  const limit = context.sampleSize ?? 20;
  for (let index = 0; index < rows.length && samples.length < limit; index += 1) {
    const row = rows[index];
    const original = originalRows[rowOrigin[index] ?? -1];
    if (!row || !original) continue;
    const cells = columnOrigin.map((source, column) => ({ before: shown(original[source]), after: shown(row[column]) }));
    if (cells.some((cell) => cell.before !== cell.after)) samples.push({ row: (rowOrigin[index] ?? 0) + 2, cells });
  }

  return { header, rows, steps, rowsBefore: input.rows.length, rowsAfter: rows.length, samples };
}
