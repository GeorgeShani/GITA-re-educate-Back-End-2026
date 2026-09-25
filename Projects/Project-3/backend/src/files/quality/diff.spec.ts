import { describe, expect, it } from 'vitest';
import { NULL_PERCENT_CHANGE_THRESHOLD, type ReportSnapshot, diffMetrics } from './diff.js';
import { type CellValue, MetricsAccumulator } from './metrics.js';

function snapshot(header: CellValue[], rows: CellValue[][], qualityScore: number | null = null): ReportSnapshot {
  const accumulator = new MetricsAccumulator(header);
  for (const row of rows) accumulator.addRow(row);
  return { metrics: accumulator.finish(), qualityScore };
}

describe('diffMetrics', () => {
  it('reports nothing for two identical files', () => {
    const file = snapshot(['id', 'name'], [['1', 'a'], ['2', 'b']], 90);
    const diff = diffMetrics(file, file);

    expect(diff).toMatchObject({
      columnsAdded: [],
      columnsRemoved: [],
      typeChanges: [],
      nullPercentChanges: [],
      schemaChanged: false,
      rowCount: { from: 2, to: 2, delta: 0 },
      qualityScore: { from: 90, to: 90, delta: 0 },
    });
  });

  it('finds added and removed columns, ignoring case and order', () => {
    const before = snapshot(['ID', 'Name', 'legacy'], [['1', 'a', 'x']]);
    const after = snapshot(['name', 'id', 'email'], [['a', '1', 'e']]);

    const diff = diffMetrics(before, after);

    expect(diff.columnsAdded).toEqual(['email']);
    expect(diff.columnsRemoved).toEqual(['legacy']);
    expect(diff.schemaChanged).toBe(true);
    expect(diff.columnCount).toEqual({ from: 3, to: 3, delta: 0 });
  });

  it('a renamed header is one column removed and one added', () => {
    const diff = diffMetrics(snapshot(['id', 'amount'], [['1', '5']]), snapshot(['id', 'total'], [['1', '5']]));

    expect(diff.columnsRemoved).toEqual(['amount']);
    expect(diff.columnsAdded).toEqual(['total']);
  });

  it('a column that only appears is not a schema change, but one that disappears is', () => {
    const base = snapshot(['id'], [['1']]);
    expect(diffMetrics(base, snapshot(['id', 'extra'], [['1', 'x']])).schemaChanged).toBe(false);
    expect(diffMetrics(snapshot(['id', 'extra'], [['1', 'x']]), base).schemaChanged).toBe(true);
  });

  it('finds a type change, using the newer name, and treats it as a schema change', () => {
    const before = snapshot(['Amount'], [['1'], ['2']]);
    const after = snapshot(['amount'], [['one'], ['two']]);

    const diff = diffMetrics(before, after);

    expect(diff.typeChanges).toEqual([{ column: 'amount', from: 'integer', to: 'string' }]);
    expect(diff.schemaChanged).toBe(true);
  });

  it('an all-empty column has no type to change from or to', () => {
    const empty = snapshot(['v'], [[null], [null]]);
    const typed = snapshot(['v'], [['1'], ['2']]);

    expect(diffMetrics(empty, typed).typeChanges).toEqual([]);
    expect(diffMetrics(typed, empty).typeChanges).toEqual([]);
  });

  it('integer to decimal is a type change (a reader that expected whole numbers is affected)', () => {
    const diff = diffMetrics(snapshot(['n'], [['1'], ['2']]), snapshot(['n'], [['1.5'], ['2']]));
    expect(diff.typeChanges).toEqual([{ column: 'n', from: 'integer', to: 'number' }]);
  });

  describe('changes in the share of empty cells', () => {
    const rows = (empties: number, total: number): CellValue[][] =>
      Array.from({ length: total }, (_, index) => [index < empties ? null : 'x']);

    it(`are reported from ${NULL_PERCENT_CHANGE_THRESHOLD} percentage points up, in either direction`, () => {
      const clean = snapshot(['a'], rows(0, 100));

      expect(diffMetrics(clean, snapshot(['a'], rows(4, 100))).nullPercentChanges).toEqual([]);
      expect(diffMetrics(clean, snapshot(['a'], rows(5, 100))).nullPercentChanges).toEqual([
        { column: 'a', from: 0, to: 5, delta: 5 },
      ]);
      expect(diffMetrics(snapshot(['a'], rows(20, 100)), clean).nullPercentChanges).toEqual([
        { column: 'a', from: 20, to: 0, delta: -20 },
      ]);
    });

    it('do not count as a schema change', () => {
      const diff = diffMetrics(snapshot(['a'], rows(0, 10)), snapshot(['a'], rows(10, 10)));
      expect(diff.nullPercentChanges).toHaveLength(1);
      expect(diff.schemaChanged).toBe(false);
    });
  });

  it('gives the change in rows, duplicate rows and quality score', () => {
    const before = snapshot(['a'], [['1'], ['2'], ['2']], 60);
    const after = snapshot(['a'], [['1'], ['2'], ['3'], ['4']], 85);

    const diff = diffMetrics(before, after);

    expect(diff.rowCount).toEqual({ from: 3, to: 4, delta: 1 });
    expect(diff.duplicateRows).toEqual({ from: 1, to: 0, delta: -1 });
    expect(diff.qualityScore).toEqual({ from: 60, to: 85, delta: 25 });
  });

  it('has no score change when either file was not scored', () => {
    const scored = snapshot(['a'], [['1']], 80);
    const unscored = snapshot(['a'], [['1']], null);

    expect(diffMetrics(scored, unscored).qualityScore).toEqual({ from: 80, to: null, delta: null });
    expect(diffMetrics(unscored, scored).qualityScore.delta).toBeNull();
  });
});
