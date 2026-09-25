import type { NarrativeInput } from '#/core/ai/narrative.js';
import type { ParsedSheet } from '../parsing/spreadsheet-reader.js';
import {
  type AccumulatorOptions,
  type CellValue,
  type DataQualityMetrics,
  MetricsAccumulator,
} from './metrics.js';

/** A stored preview cell: JSON-safe, so it round-trips through `jsonb` unchanged. */
export type PreviewCell = string | number | boolean | null;

export const PREVIEW_LIMITS = { rows: 50, columns: 50, cellChars: 200 } as const;

export interface Profile {
  metrics: DataQualityMetrics;
  /** Repeated values per unique-checked column (see `AccumulatorOptions.uniqueColumns`). */
  uniqueness: Record<string, number>;
  previewRows: PreviewCell[][];
}

export function previewCell(cell: CellValue | undefined): PreviewCell {
  if (cell === null || cell === undefined) return null;
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell.toISOString();
  if (typeof cell === 'string') return cell.slice(0, PREVIEW_LIMITS.cellChars);
  return cell;
}

/** Runs the metrics over a parsed sheet and keeps its first rows for the preview. */
export function profileSheet(sheet: ParsedSheet, options: AccumulatorOptions = {}): Profile {
  const accumulator = new MetricsAccumulator(sheet.header, options);
  for (const row of sheet.rows) accumulator.addRow(row);
  const metrics = accumulator.finish();

  // The accumulator notes a cut header itself; the reader knows if ROWS were cut.
  if (sheet.truncated) metrics.truncated = true;

  const previewRows = sheet.rows
    .slice(0, PREVIEW_LIMITS.rows)
    .map((row) => row.slice(0, PREVIEW_LIMITS.columns).map(previewCell));
  return { metrics, uniqueness: accumulator.uniqueness(), previewRows };
}

/** The aggregates — and only the aggregates — a narrative is written from. */
export function narrativeInputFrom(
  metrics: DataQualityMetrics,
  failedRules: NonNullable<NarrativeInput['failedRules']> = [],
): NarrativeInput {
  return {
    ...(failedRules.length > 0 ? { failedRules } : {}),
    rowCount: metrics.rowCount,
    columnCount: metrics.columnCount,
    emptyRows: metrics.emptyRows,
    duplicateRows: metrics.duplicateRows,
    truncated: metrics.truncated,
    columns: metrics.columns.map((column) => ({
      name: column.name,
      type: column.inferredType,
      nullPercent: column.nullPercent,
      inconsistentPercent: column.inconsistentPercent,
      numeric: column.numeric ? { mean: column.numeric.mean } : null,
    })),
  };
}
