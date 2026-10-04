import { describe, expect, it } from 'vitest';
import type { ParsedSheet } from '../parsing/spreadsheet-reader.js';
import type { CellValue } from '../quality/metrics.js';
import { SAMPLE_SIZE, checkKeys, diffRows, suggestKeyColumns } from './row-diff.js';

function sheet(header: string[], rows: CellValue[][]): ParsedSheet {
  return { header, rows, truncated: false, columnCount: header.length, sheet: null };
}

const BEFORE = sheet(
  ['id', 'name', 'city'],
  [
    [1, 'Ana', 'Tbilisi'],
    [2, 'Ben', 'Batumi'],
    [3, 'Cleo', 'Kutaisi'],
  ],
);

describe('diffRows', () => {
  it('counts rows added, removed, changed and unchanged, and says what changed in a cell', () => {
    const after = sheet(
      ['id', 'name', 'city'],
      [
        [1, 'Ana', 'Tbilisi'],
        [2, 'Ben', 'Poti'],
        [4, 'Dan', 'Rustavi'],
      ],
    );
    const { summary, sample } = diffRows(BEFORE, after, ['id']);
    expect(summary).toMatchObject({ added: 1, removed: 1, changed: 1, unchanged: 1, unmatchable: 0, rowsBefore: 3, rowsAfter: 3 });
    expect(summary.columnsChanged).toEqual([{ column: 'city', changed: 1 }]);
    expect(sample.find((entry) => entry.change === 'changed')).toEqual({
      change: 'changed',
      key: ['2'],
      cells: [{ column: 'city', before: 'Batumi', after: 'Poti' }],
    });
    expect(sample.find((entry) => entry.change === 'removed')?.key).toEqual(['3']);
    expect(sample.find((entry) => entry.change === 'added')?.cells).toContainEqual({ column: 'name', before: null, after: 'Dan' });
  });

  it('does not see a reordered file, a number as text, case or stray spaces in a key as a change', () => {
    const after = sheet(
      ['City', 'ID', 'Name'],
      [
        ['Tbilisi', ' 1 ', 'Ana'],
        ['Batumi', '2', 'Ben'],
        ['Kutaisi', 3, 'Cleo'],
      ],
    );
    expect(diffRows(BEFORE, after, ['id']).summary).toMatchObject({ added: 0, removed: 0, changed: 0, unchanged: 3 });
  });

  it('reports a column only one version has, without comparing it', () => {
    const after = sheet(['id', 'name', 'plan'], [[1, 'Ana', 'free'], [2, 'Ben', 'free'], [3, 'Cleo', 'free']]);
    const { summary } = diffRows(BEFORE, after, ['id']);
    expect(summary.columnsAdded).toEqual(['plan']);
    expect(summary.columnsRemoved).toEqual(['city']);
    expect(summary.changed).toBe(0);
  });

  it('leaves out rows it cannot match: an empty key, or one that appears twice on a side', () => {
    const before = sheet(['id', 'v'], [[1, 'a'], [1, 'b'], ['', 'c'], [2, 'd']]);
    const after = sheet(['id', 'v'], [[1, 'a'], [2, 'e'], [3, 'f'], [3, 'g']]);
    const { summary } = diffRows(before, after, ['id']);
    expect(summary).toMatchObject({ unmatchable: 6, changed: 1, added: 0, removed: 0 });
  });

  it('matches by several columns together', () => {
    const before = sheet(['a', 'b', 'v'], [[1, 'x', 1], [1, 'y', 2]]);
    const after = sheet(['a', 'b', 'v'], [[1, 'x', 1], [1, 'y', 9]]);
    const { summary, sample } = diffRows(before, after, ['a', 'b']);
    expect(summary).toMatchObject({ changed: 1, unchanged: 1 });
    expect(sample[0]?.key).toEqual(['1', 'y']);
  });

  it('keeps a bounded sample but can hand back every change', () => {
    const rows = Array.from({ length: SAMPLE_SIZE + 50 }, (_, index) => [index, 'a'] as CellValue[]);
    const changed = rows.map(([id]) => [id, 'b'] as CellValue[]);
    const result = diffRows(sheet(['id', 'v'], rows), sheet(['id', 'v'], changed), ['id'], { all: true });
    expect(result.summary.changed).toBe(SAMPLE_SIZE + 50);
    expect(result.sample).toHaveLength(SAMPLE_SIZE);
    expect(result.all).toHaveLength(SAMPLE_SIZE + 50);
  });

  it('reads dates by day', () => {
    const before = sheet(['id', 'd'], [[1, new Date('2026-01-02T00:00:00Z')]]);
    const after = sheet(['id', 'd'], [[1, '2026-01-02']]);
    expect(diffRows(before, after, ['id']).summary.changed).toBe(0);
  });
});

describe('checkKeys', () => {
  it('refuses no keys and a key column a version does not have', () => {
    expect(checkKeys(BEFORE, BEFORE, [])).toEqual({ kind: 'no_keys' });
    expect(checkKeys(BEFORE, sheet(['x'], []), ['id'])).toEqual({ kind: 'missing', side: 'after', column: 'id' });
    expect(checkKeys(BEFORE, BEFORE, ['ID'])).toBeNull();
  });
});

describe('suggestKeyColumns', () => {
  it('offers a column whose name says it identifies a row, preferring a plain id', () => {
    expect(suggestKeyColumns(['name', 'customer_id', 'id'], ['id', 'name', 'customer_id'])).toEqual(['id']);
    expect(suggestKeyColumns(['name', 'Customer ID'], ['Customer ID', 'name'])).toEqual(['Customer ID']);
    expect(suggestKeyColumns(['name', 'city'], ['name', 'city'])).toEqual([]);
    expect(suggestKeyColumns(['sku'], ['name'])).toEqual([]);
  });
});
