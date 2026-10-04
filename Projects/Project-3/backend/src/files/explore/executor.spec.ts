import { describe, expect, it } from 'vitest';
import { type QuerySpec, querySpecSchema } from '#/core/ai/query-spec.js';
import type { ParsedSheet } from '../parsing/spreadsheet-reader.js';
import type { CellValue } from '../quality/metrics.js';
import { QueryError, runQuery } from './executor.js';

const sheet = (header: string[], rows: CellValue[][]): ParsedSheet => ({ header, rows, truncated: false, columnCount: header.length, sheet: null });

const SALES = sheet(
  ['Region', 'Product', 'Revenue', 'Sold on'],
  [
    ['North', 'A', 100, '2026-01-05'],
    ['North', 'B', '250.50', '2026-02-10'],
    ['south', 'A', 40, '2026-02-11'],
    ['South', 'B', 'n/a', '2026-03-01'],
    ['', 'A', 10, '2026-03-02'],
  ],
);

const spec = (input: unknown): QuerySpec => querySpecSchema.parse(input);

describe('runQuery', () => {
  it('groups, counts and sums, biggest first, ignoring the case of a group', () => {
    const result = runQuery(SALES, spec({ groupBy: ['region'], measures: [{ fn: 'count' }, { fn: 'sum', column: 'Revenue' }] }));
    expect(result.columns.map((column) => column.name)).toEqual(['Region', 'Rows', 'Sum of Revenue']);
    expect(result.rows).toEqual([
      ['North', 2, 350.5],
      ['south', 2, 40],
      ['(empty)', 1, 10],
    ]);
    expect(result.notes).toEqual(['1 cell in "Revenue" were not numbers and were left out.']);
    expect(result.rowsMatched).toBe(5);
  });

  it('filters before it groups', () => {
    const result = runQuery(SALES, spec({ filters: [{ column: 'Product', op: 'equals', value: 'a' }, { column: 'Revenue', op: 'greater', value: 20 }], measures: [{ fn: 'count' }] }));
    expect(result.rows).toEqual([[2]]);
    expect(result.rowsScanned).toBe(5);
  });

  it('reads dates as text that sorts, and contains / empty / not_empty', () => {
    expect(runQuery(SALES, spec({ filters: [{ column: 'Sold on', op: 'less', value: '2026-02-11' }] })).rows).toEqual([[2]]);
    expect(runQuery(SALES, spec({ filters: [{ column: 'Region', op: 'contains', value: 'OUT' }] })).rows).toEqual([[2]]);
    expect(runQuery(SALES, spec({ filters: [{ column: 'Region', op: 'empty' }] })).rows).toEqual([[1]]);
    expect(runQuery(SALES, spec({ filters: [{ column: 'Region', op: 'not_empty' }] })).rows).toEqual([[4]]);
  });

  it('averages, finds the lowest and the highest, counts different values, and sorts and cuts', () => {
    const result = runQuery(
      SALES,
      spec({
        groupBy: ['Product'],
        measures: [{ fn: 'average', column: 'Revenue' }, { fn: 'min', column: 'Revenue' }, { fn: 'max', column: 'Revenue' }, { fn: 'distinct', column: 'Region' }],
        sort: { by: 'measure', index: 0, direction: 'asc' },
        limit: 1,
      }),
    );
    expect(result.columns.map((column) => column.name)).toEqual(['Product', 'Average of Revenue', 'Lowest of Revenue', 'Highest of Revenue', 'Different of Region']);
    expect(result.rows).toEqual([['A', 50, 10, 100, 2]]);
    expect(result.groupCount).toBe(2);
  });

  it('answers a total with no groups, and an empty result for no matching rows', () => {
    expect(runQuery(SALES, spec({ measures: [{ fn: 'sum', column: 'Revenue' }] })).rows).toEqual([[400.5]]);
    expect(runQuery(SALES, spec({ filters: [{ column: 'Product', op: 'equals', value: 'Z' }], measures: [{ fn: 'sum', column: 'Revenue' }] })).rows).toEqual([[null]]);
  });

  it('refuses a column that is not there and a number asked of text', () => {
    expect(() => runQuery(SALES, spec({ groupBy: ['Country'] }))).toThrow(new QueryError('This file has no column "Country".'));
    expect(() => runQuery(SALES, spec({ measures: [{ fn: 'sum', column: 'Product' }] }))).toThrow(/holds no numbers/);
  });
});

describe('querySpecSchema', () => {
  it('fills the defaults and refuses a measure without its column, a filter without its value, and a sort off the end', () => {
    expect(spec({})).toMatchObject({ filters: [], groupBy: [], measures: [{ fn: 'count' }], limit: 50 });
    expect(querySpecSchema.safeParse({ measures: [{ fn: 'sum' }] }).success).toBe(false);
    expect(querySpecSchema.safeParse({ filters: [{ column: 'a', op: 'equals' }] }).success).toBe(false);
    expect(querySpecSchema.safeParse({ sort: { by: 'group', index: 0, direction: 'asc' } }).success).toBe(false);
    expect(querySpecSchema.safeParse({ groupBy: ['a', 'b', 'c'] }).success).toBe(false);
  });
});
