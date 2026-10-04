import type { CellValue } from '../quality/metrics.js';
import type { ParsedSheet } from '../parsing/spreadsheet-reader.js';

/** How many changed rows a stored diff keeps to browse; the full list is the CSV. */
export const SAMPLE_SIZE = 500;

export type RowChange = 'added' | 'removed' | 'changed';

export interface ChangedCell {
  column: string;
  before: string | null;
  after: string | null;
}

/** One row that is not the same in both versions. `cells` lists only what differs for a changed row, and every cell for an added or removed one. */
export interface RowChangeEntry {
  change: RowChange;
  /** The values of the key columns, in the order the keys were given. */
  key: string[];
  cells: ChangedCell[];
}

export interface DiffSummary {
  keyColumns: string[];
  rowsBefore: number;
  rowsAfter: number;
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  /** Rows whose key is empty, or appears more than once on one side: they cannot be matched, so they are left out of the counts. */
  unmatchable: number;
  /** Columns present in both versions, with how many rows changed in each, most first. */
  columnsChanged: Array<{ column: string; changed: number }>;
  /** Columns only one version has (their values are not compared). */
  columnsAdded: string[];
  columnsRemoved: string[];
}

export interface RowDiff {
  summary: DiffSummary;
  /** The first `SAMPLE_SIZE` entries, rows removed first, then added, then changed. */
  sample: RowChangeEntry[];
  /** Every entry, for the downloadable file. Absent unless asked for (it can be as long as the data). */
  all?: RowChangeEntry[];
}

export type KeyProblem = { kind: 'no_keys' } | { kind: 'missing'; side: 'before' | 'after'; column: string };

const norm = (name: string): string => name.trim().toLowerCase();

function text(cell: CellValue | undefined): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString().replace(/T00:00:00\.000Z$/, '');
  return String(cell).trim();
}

/** A cell for the browsable sample is cut short; for the download (`all`) it is whole. */
const shown = (value: string, whole: boolean): string | null =>
  value === '' ? null : !whole && value.length > 200 ? `${value.slice(0, 200)}…` : value;

/** The header as column names, with a blank one given a stand-in so it can still be shown. */
function names(sheet: ParsedSheet): string[] {
  return sheet.header.map((cell, index) => {
    const name = text(cell);
    return name === '' ? `Column ${index + 1}` : name;
  });
}

/** Which key columns a pair of sheets lacks: a diff by a column that is not there cannot mean anything, so it is refused. */
export function checkKeys(before: ParsedSheet, after: ParsedSheet, keyColumns: readonly string[]): KeyProblem | null {
  if (keyColumns.length === 0) return { kind: 'no_keys' };
  const beforeNames = new Set(names(before).map(norm));
  const afterNames = new Set(names(after).map(norm));
  for (const column of keyColumns) {
    if (!beforeNames.has(norm(column))) return { kind: 'missing', side: 'before', column };
    if (!afterNames.has(norm(column))) return { kind: 'missing', side: 'after', column };
  }
  return null;
}

interface Side {
  header: string[];
  /** The index of each key column, in key order. */
  keyAt: number[];
  rows: CellValue[][];
}

function sideOf(sheet: ParsedSheet, keyColumns: readonly string[]): Side {
  const header = names(sheet);
  const lookup = new Map<string, number>();
  header.forEach((name, index) => {
    if (!lookup.has(norm(name))) lookup.set(norm(name), index);
  });
  return { header, keyAt: keyColumns.map((column) => lookup.get(norm(column)) ?? -1), rows: sheet.rows };
}

/** The rows of a side by key. A key that is empty or repeated is unusable: it is recorded as such and not matched to anything. */
function indexRows(side: Side): { byKey: Map<string, CellValue[]>; repeated: Set<string>; unmatchable: number } {
  const byKey = new Map<string, CellValue[]>();
  const repeated = new Set<string>();
  let unmatchable = 0;
  for (const row of side.rows) {
    const parts = side.keyAt.map((at) => text(row[at]));
    if (parts.some((part) => part === '')) {
      unmatchable += 1;
      continue;
    }
    const key = parts.map(norm).join('\u0000');
    if (repeated.has(key)) {
      unmatchable += 1;
    } else if (byKey.has(key)) {
      byKey.delete(key);
      repeated.add(key);
      unmatchable += 2;
    } else {
      byKey.set(key, row);
    }
  }
  return { byKey, repeated, unmatchable };
}

/**
 * Compares two versions of a sheet row by row, matching rows by the values of the key columns (case and surrounding spaces
 * ignored). Columns are matched by name, so a reordered file does not look changed, and a column only one side has is
 * reported, not compared. Pure: both sheets are already in memory, and it reads nothing.
 */
export function diffRows(before: ParsedSheet, after: ParsedSheet, keyColumns: readonly string[], options: { all?: boolean } = {}): RowDiff {
  const whole = options.all === true;
  const left = sideOf(before, keyColumns);
  const right = sideOf(after, keyColumns);
  const leftIndex = indexRows(left);
  const rightIndex = indexRows(right);
  // A key that cannot be trusted on one side cannot be matched on the other either: that row is left out, not called new or gone.
  let excluded = 0;
  for (const [mine, theirs] of [[leftIndex, rightIndex], [rightIndex, leftIndex]] as const) {
    for (const key of mine.repeated) {
      if (theirs.byKey.delete(key)) excluded += 1;
    }
  }

  const rightAt = new Map(right.header.map((name, index) => [norm(name), index] as const));
  const shared = left.header.flatMap((name, index) => {
    const other = rightAt.get(norm(name));
    return other === undefined ? [] : [{ name, left: index, right: other }];
  });
  const leftNames = new Set(left.header.map(norm));
  const columnsRemoved = left.header.filter((name) => !rightAt.has(norm(name)));
  const columnsAdded = right.header.filter((name) => !leftNames.has(norm(name)));

  const removed: RowChangeEntry[] = [];
  const added: RowChangeEntry[] = [];
  const changed: RowChangeEntry[] = [];
  const perColumn = new Map<string, number>();
  let unchanged = 0;

  const keyOf = (row: CellValue[], side: Side) => side.keyAt.map((at) => text(row[at]));

  for (const [key, row] of leftIndex.byKey) {
    const match = rightIndex.byKey.get(key);
    if (!match) {
      removed.push({
        change: 'removed',
        key: keyOf(row, left),
        cells: left.header.map((name, index) => ({ column: name, before: shown(text(row[index]), whole), after: null })),
      });
      continue;
    }
    const cells: ChangedCell[] = [];
    for (const column of shared) {
      const was = text(row[column.left]);
      const now = text(match[column.right]);
      if (was !== now) {
        cells.push({ column: column.name, before: shown(was, whole), after: shown(now, whole) });
        perColumn.set(column.name, (perColumn.get(column.name) ?? 0) + 1);
      }
    }
    if (cells.length === 0) unchanged += 1;
    else changed.push({ change: 'changed', key: keyOf(row, left), cells });
  }
  for (const [key, row] of rightIndex.byKey) {
    if (leftIndex.byKey.has(key)) continue;
    added.push({
      change: 'added',
      key: keyOf(row, right),
      cells: right.header.map((name, index) => ({ column: name, before: null, after: shown(text(row[index]), whole) })),
    });
  }

  const everything = [...removed, ...added, ...changed];
  return {
    summary: {
      keyColumns: [...keyColumns],
      rowsBefore: before.rows.length,
      rowsAfter: after.rows.length,
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      unchanged,
      unmatchable: leftIndex.unmatchable + rightIndex.unmatchable + excluded,
      columnsChanged: [...perColumn].map(([column, count]) => ({ column, changed: count })).sort((a, b) => b.changed - a.changed || a.column.localeCompare(b.column)),
      columnsAdded,
      columnsRemoved,
    },
    sample: everything.slice(0, SAMPLE_SIZE),
    ...(options.all ? { all: everything } : {}),
  };
}

const KEY_NAME = /(^|[\s_-])(id|uuid|guid|key|sku|code|number|no|ref|reference|email)$|^(id|uuid|guid)([\s_-]|$)/i;

/** Columns whose names say they identify something, from the columns both versions have; the person confirms. */
export function suggestKeyColumns(before: readonly string[], after: readonly string[]): string[] {
  const afterNames = new Set(after.map(norm));
  const candidates = before.filter((name) => afterNames.has(norm(name)) && KEY_NAME.test(name.trim()));
  const exactId = candidates.find((name) => /^(id|uuid|guid)$/i.test(name.trim()));
  if (exactId) return [exactId];
  return candidates.slice(0, 1);
}
