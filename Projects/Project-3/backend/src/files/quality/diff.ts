import { type ColumnType, type DataQualityMetrics, columnKey } from './metrics.js';

/** A change in a column's share of empty cells is only worth reporting from this many percentage points. */
export const NULL_PERCENT_CHANGE_THRESHOLD = 5;

/** What a comparison needs from a finished report. */
export interface ReportSnapshot {
  metrics: DataQualityMetrics;
  qualityScore: number | null;
}

export interface Change<T> {
  from: T;
  to: T;
  /** `to - from`, rounded to two decimals; null when either side is null. */
  delta: number | null;
}

export interface MetricsDiff {
  /** Names as the NEWER file spells them. */
  columnsAdded: string[];
  /** Names as the OLDER file spelled them. */
  columnsRemoved: string[];
  typeChanges: Array<{ column: string; from: ColumnType; to: ColumnType }>;
  nullPercentChanges: Array<{ column: string; from: number; to: number; delta: number }>;
  rowCount: Change<number>;
  columnCount: Change<number>;
  duplicateRows: Change<number>;
  qualityScore: Change<number | null>;
  /** A column was removed or changed type: what breaks a reader of the data, unlike a new column or a shift in blanks. */
  schemaChanged: boolean;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

function change<T extends number | null>(from: T, to: T): Change<T> {
  return { from, to, delta: from === null || to === null ? null : round2(to - from) };
}

/**
 * How one report differs from another, from the stored metrics alone (nothing is re-read from the
 * files). Columns are matched by name ignoring case — a renamed header therefore shows up as one
 * column removed and one added, which is exactly what a reader of the data would experience.
 * A column that is entirely empty on either side has no type to compare, so it is never a type change.
 */
export function diffMetrics(from: ReportSnapshot, to: ReportSnapshot): MetricsDiff {
  const before = new Map(from.metrics.columns.map((column) => [columnKey(column.name), column]));
  const after = new Map(to.metrics.columns.map((column) => [columnKey(column.name), column]));

  const columnsAdded = to.metrics.columns.filter((column) => !before.has(columnKey(column.name))).map((column) => column.name);
  const columnsRemoved = from.metrics.columns.filter((column) => !after.has(columnKey(column.name))).map((column) => column.name);

  const typeChanges: MetricsDiff['typeChanges'] = [];
  const nullPercentChanges: MetricsDiff['nullPercentChanges'] = [];
  for (const column of to.metrics.columns) {
    const previous = before.get(columnKey(column.name));
    if (!previous) continue;

    if (previous.inferredType !== column.inferredType && previous.inferredType !== 'empty' && column.inferredType !== 'empty') {
      typeChanges.push({ column: column.name, from: previous.inferredType, to: column.inferredType });
    }
    const delta = round2(column.nullPercent - previous.nullPercent);
    if (Math.abs(delta) >= NULL_PERCENT_CHANGE_THRESHOLD) {
      nullPercentChanges.push({ column: column.name, from: previous.nullPercent, to: column.nullPercent, delta });
    }
  }

  return {
    columnsAdded,
    columnsRemoved,
    typeChanges,
    nullPercentChanges,
    rowCount: change(from.metrics.rowCount, to.metrics.rowCount),
    columnCount: change(from.metrics.columnCount, to.metrics.columnCount),
    duplicateRows: change(from.metrics.duplicateRows, to.metrics.duplicateRows),
    qualityScore: change(from.qualityScore, to.qualityScore),
    schemaChanged: columnsRemoved.length > 0 || typeChanges.length > 0,
  };
}
