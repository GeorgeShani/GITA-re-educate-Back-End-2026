import type { QueryFilter, QueryMeasure, QuerySpec } from '#/core/ai/query-spec.js';
import { parseNumber } from '../cleaning/parsers.js';
import type { ParsedSheet } from '../parsing/spreadsheet-reader.js';
import type { CellValue } from '../quality/metrics.js';

/** A question the data cannot answer: a column that is not there, or a number asked of text. Shown to the person as it is. */
export class QueryError extends Error {}

export type ResultCell = string | number | null;

export interface ResultColumn {
  name: string;
  kind: 'group' | 'measure';
}

export interface QueryResult {
  columns: ResultColumn[];
  rows: ResultCell[][];
  /** Rows that passed the filters. */
  rowsMatched: number;
  /** Rows in the file. */
  rowsScanned: number;
  /** How many groups there were before the limit cut the list. */
  groupCount: number;
  /** Things worth saying: cells that were not numbers and were skipped. */
  notes: string[];
}

const norm = (name: string): string => name.trim().toLowerCase();

function text(cell: CellValue | undefined): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString().replace(/T00:00:00\.000Z$/, '');
  return String(cell).trim();
}

/** A cell as a number: a real number, or text this reads as one (`1,234.50`, `$12`). Anything else is not a number. */
function numeric(cell: CellValue | undefined): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (cell === null || cell === undefined || cell instanceof Date || typeof cell === 'boolean') return null;
  const raw = cell.trim();
  return raw === '' ? null : parseNumber(raw, '.');
}

function columnIndex(sheet: ParsedSheet): Map<string, number> {
  const lookup = new Map<string, number>();
  sheet.header.forEach((cell, index) => {
    const name = text(cell);
    if (name !== '' && !lookup.has(norm(name))) lookup.set(norm(name), index);
  });
  return lookup;
}

function resolve(lookup: Map<string, number>, name: string): number {
  const at = lookup.get(norm(name));
  if (at === undefined) throw new QueryError(`This file has no column "${name}".`);
  return at;
}

function passes(filter: QueryFilter, cell: CellValue | undefined): boolean {
  const shown = text(cell);
  switch (filter.op) {
    case 'empty':
      return shown === '';
    case 'not_empty':
      return shown !== '';
    case 'equals': {
      const want = String(filter.value ?? '').trim();
      if (shown.toLowerCase() === want.toLowerCase()) return true;
      const [a, b] = [numeric(cell), parseNumber(want, '.')];
      return a !== null && b !== null && a === b;
    }
    case 'contains':
      return shown.toLowerCase().includes(String(filter.value ?? '').trim().toLowerCase());
    case 'greater':
    case 'less': {
      if (shown === '') return false;
      const want = typeof filter.value === 'number' ? filter.value : parseNumber(String(filter.value ?? ''), '.');
      const have = numeric(cell);
      // Numbers when both are numbers; otherwise as text, which orders ISO dates correctly.
      const order = want !== null && have !== null ? have - want : shown.localeCompare(String(filter.value ?? ''));
      return filter.op === 'greater' ? order > 0 : order < 0;
    }
  }
}

interface Accumulator {
  rows: number;
  sums: number[];
  counts: number[];
  mins: number[];
  maxs: number[];
  distinct: Array<Set<string> | null>;
}

const fresh = (measures: readonly QueryMeasure[]): Accumulator => ({
  rows: 0,
  sums: measures.map(() => 0),
  counts: measures.map(() => 0),
  mins: measures.map(() => Number.POSITIVE_INFINITY),
  maxs: measures.map(() => Number.NEGATIVE_INFINITY),
  distinct: measures.map((measure) => (measure.fn === 'distinct' ? new Set<string>() : null)),
});

const round = (value: number): number => Math.round(value * 1e6) / 1e6;

export function measureName(measure: QueryMeasure): string {
  if (measure.fn === 'count') return 'Rows';
  const word = { sum: 'Sum', average: 'Average', min: 'Lowest', max: 'Highest', distinct: 'Different' }[measure.fn];
  return `${word} of ${measure.column}`;
}

/**
 * Runs a question over a whole sheet: filter, group, compute, sort, cut. Pure: the sheet is already in memory and nothing else
 * is read. Columns are found by name (case and spaces ignored). A sum, average, lowest or highest of a column skips the cells that
 * are not numbers and says how many it skipped; a column with no numbers at all is a question the data cannot answer.
 */
export function runQuery(sheet: ParsedSheet, spec: QuerySpec): QueryResult {
  const lookup = columnIndex(sheet);
  const filters = spec.filters.map((filter) => ({ filter, at: resolve(lookup, filter.column) }));
  const groups = spec.groupBy.map((name) => {
    const at = resolve(lookup, name);
    return { name: text(sheet.header[at]), at };
  });
  const measures = spec.measures.map((measure) => ({ measure, at: measure.column === undefined ? -1 : resolve(lookup, measure.column) }));

  const buckets = new Map<string, { key: string[]; acc: Accumulator }>();
  const skipped = measures.map(() => 0);
  let matched = 0;

  for (const row of sheet.rows) {
    if (!filters.every(({ filter, at }) => passes(filter, row[at]))) continue;
    matched += 1;
    const key = groups.map(({ at }) => {
      const value = text(row[at]);
      return value === '' ? '(empty)' : value;
    });
    const id = key.map((part) => part.toLowerCase()).join('\u0000');
    const bucket = buckets.get(id) ?? { key, acc: fresh(spec.measures) };
    buckets.set(id, bucket);
    bucket.acc.rows += 1;
    measures.forEach(({ measure, at }, index) => {
      if (measure.fn === 'count') return;
      if (measure.fn === 'distinct') {
        const value = text(row[at]);
        if (value !== '') bucket.acc.distinct[index]?.add(value.toLowerCase());
        return;
      }
      const number = numeric(row[at]);
      if (number === null) {
        if (text(row[at]) !== '') skipped[index] = (skipped[index] ?? 0) + 1;
        return;
      }
      bucket.acc.sums[index] = (bucket.acc.sums[index] ?? 0) + number;
      bucket.acc.counts[index] = (bucket.acc.counts[index] ?? 0) + 1;
      bucket.acc.mins[index] = Math.min(bucket.acc.mins[index] ?? number, number);
      bucket.acc.maxs[index] = Math.max(bucket.acc.maxs[index] ?? number, number);
    });
  }

  // A total over no matching rows is still one answer (a count of 0), as a database would give.
  if (groups.length === 0 && buckets.size === 0) buckets.set('', { key: [], acc: fresh(spec.measures) });

  const notes: string[] = [];
  measures.forEach(({ measure }, index) => {
    if (measure.fn === 'count' || measure.fn === 'distinct') return;
    const used = [...buckets.values()].reduce((sum, bucket) => sum + (bucket.acc.counts[index] ?? 0), 0);
    if (used === 0 && matched > 0) {
      throw new QueryError(`"${measure.column}" holds no numbers, so its ${measure.fn === 'average' ? 'average' : measure.fn === 'sum' ? 'sum' : measure.fn === 'min' ? 'lowest value' : 'highest value'} cannot be worked out.`);
    }
    const count = skipped[index] ?? 0;
    if (count > 0) notes.push(`${count.toLocaleString('en-US')} cell${count === 1 ? '' : 's'} in "${measure.column}" were not numbers and were left out.`);
  });

  const table = [...buckets.values()].map(({ key, acc }) => ({
    key,
    values: measures.map(({ measure }, index): ResultCell => {
      switch (measure.fn) {
        case 'count':
          return acc.rows;
        case 'distinct':
          return acc.distinct[index]?.size ?? 0;
        case 'sum':
          return acc.counts[index] ? round(acc.sums[index] ?? 0) : null;
        case 'average':
          return acc.counts[index] ? round((acc.sums[index] ?? 0) / (acc.counts[index] ?? 1)) : null;
        case 'min':
          return acc.counts[index] ? (acc.mins[index] ?? null) : null;
        case 'max':
          return acc.counts[index] ? (acc.maxs[index] ?? null) : null;
      }
    }),
  }));

  const direction = spec.sort?.direction === 'asc' ? 1 : -1;
  if (spec.sort) {
    const { by, index } = spec.sort;
    table.sort((a, b) => {
      if (by === 'group') return direction * (a.key[index] ?? '').localeCompare(b.key[index] ?? '', undefined, { numeric: true });
      const [x, y] = [a.values[index] ?? null, b.values[index] ?? null];
      // Empty results sort last whichever way the list runs.
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return direction * (Number(x) - Number(y));
    });
  } else if (groups.length > 0) {
    // No sort asked for: biggest groups first, which is what a person reading "by region" wants.
    table.sort((a, b) => Number(b.values[0] ?? 0) - Number(a.values[0] ?? 0) || (a.key[0] ?? '').localeCompare(b.key[0] ?? ''));
  }

  return {
    columns: [...groups.map(({ name }): ResultColumn => ({ name, kind: 'group' })), ...spec.measures.map((measure): ResultColumn => ({ name: measureName(measure), kind: 'measure' }))],
    rows: table.slice(0, spec.limit).map(({ key, values }) => [...key, ...values]),
    rowsMatched: matched,
    rowsScanned: sheet.rows.length,
    groupCount: table.length,
    notes,
  };
}
