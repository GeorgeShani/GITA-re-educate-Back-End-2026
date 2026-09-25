import { describe, expect, it } from 'vitest';
import { type CellValue, MetricsAccumulator, PROFILE_LIMITS, classify, normaliseHeader } from './metrics.js';

function profile(header: CellValue[], rows: CellValue[][]) {
  const accumulator = new MetricsAccumulator(header);
  for (const row of rows) accumulator.addRow(row);
  return accumulator.finish();
}

describe('classify', () => {
  it.each<[CellValue | undefined, string]>([
    [null, 'null'],
    [undefined, 'null'],
    ['', 'null'],
    ['   ', 'null'],
    [7, 'integer'],
    [-7, 'integer'],
    [7.5, 'number'],
    ['42', 'integer'],
    ['-42', 'integer'],
    ['+3', 'integer'],
    ['3.14', 'number'],
    ['.5', 'number'],
    ['1e5', 'number'],
    [' 12 ', 'integer'],
    [true, 'boolean'],
    ['TRUE', 'boolean'],
    ['false', 'boolean'],
    [new Date('2026-01-02'), 'date'],
    ['2026-01-02', 'date'],
    ['2026-01-02T10:30:00Z', 'date'],
    ['2026-01-02 10:30', 'date'],
    ['hello', 'string'],
    ['12abc', 'string'],
    ['1,234', 'string'],
    ['2026-13-45', 'string'],
    ['N/A', 'string'],
    [Number.POSITIVE_INFINITY, 'string'],
    [new Date('nope'), 'null'],
  ])('%j → %s', (cell, expected) => {
    expect(classify(cell)).toBe(expected);
  });
});

describe('normaliseHeader', () => {
  it('names blank headers and de-duplicates repeats, reporting each fix', () => {
    const { names, issues } = normaliseHeader(['id', '', 'Name', 'name', null, 'id']);

    expect(names).toEqual(['id', 'column_2', 'Name', 'name_2', 'column_5', 'id_2']);
    expect(issues).toHaveLength(4);
    expect(issues.join(' ')).toMatch(/no header.*column_2/);
    expect(issues.join(' ')).toMatch(/"id" appears more than once/);
  });

  it('says nothing about a clean header', () => {
    expect(normaliseHeader(['a', 'b']).issues).toEqual([]);
  });
});

describe('MetricsAccumulator', () => {
  it('counts rows and columns, header excluded', () => {
    const metrics = profile(['a', 'b'], [['1', 'x'], ['2', 'y'], ['3', 'z']]);

    expect(metrics).toMatchObject({ rowCount: 3, columnCount: 2, truncated: false, headerIssues: [] });
    expect(metrics.columns.map((column) => column.name)).toEqual(['a', 'b']);
  });

  it('an empty file (header only) has zero rows and empty columns', () => {
    const metrics = profile(['a', 'b'], []);

    expect(metrics.rowCount).toBe(0);
    expect(metrics.columns.every((column) => column.inferredType === 'empty' && column.nullPercent === 0)).toBe(true);
  });

  describe('nulls', () => {
    it('reports the count and percent per column, treating blanks and whitespace as empty', () => {
      const metrics = profile(['a'], [['1'], [''], ['  '], [null], ['2'], ['3'], ['4'], ['5']]);

      expect(metrics.columns[0]).toMatchObject({ nullCount: 3, nullPercent: 37.5 });
    });

    it('rounds to two decimals', () => {
      const metrics = profile(['a'], [[''], ['1'], ['2']]);
      expect(metrics.columns[0]?.nullPercent).toBe(33.33);
    });

    it('a column of only blanks is `empty`, 100% null', () => {
      const metrics = profile(['a'], [[''], [null], ['  ']]);
      expect(metrics.columns[0]).toMatchObject({ inferredType: 'empty', nullPercent: 100, inconsistent: false });
    });

    it('a short row counts the missing cells as null, and the row as ragged', () => {
      const metrics = profile(['a', 'b', 'c'], [['1', '2', '3'], ['1']]);

      expect(metrics.raggedRows).toBe(1);
      expect(metrics.columns[2]?.nullCount).toBe(1);
    });

    it('a long row is ragged but its extra cells are ignored', () => {
      const metrics = profile(['a'], [['1', '2', '3']]);
      expect(metrics).toMatchObject({ raggedRows: 1, columnCount: 1 });
    });
  });

  describe('type inference', () => {
    it.each<[string, CellValue[], string]>([
      ['integers', [1, 2, 3], 'integer'],
      ['integers as text', ['1', '2', '3'], 'integer'],
      ['decimals', [1.5, 2.5], 'number'],
      ['integers and decimals are one numeric family', [1, 2, 3.5], 'number'],
      ['booleans', [true, false, 'true'], 'boolean'],
      ['dates', ['2026-01-01', '2026-02-01'], 'date'],
      ['real Date cells', [new Date('2026-01-01'), new Date('2026-02-01')], 'date'],
      ['text', ['a', 'b'], 'string'],
    ])('%s → %s', (_name, values, expected) => {
      const metrics = profile(['c'], values.map((value) => [value]));
      expect(metrics.columns[0]?.inferredType).toBe(expected);
      expect(metrics.columns[0]?.inconsistent).toBe(false);
    });

    it('flags a mixed column, takes the dominant type, and says how much disagrees', () => {
      const metrics = profile(['age'], [[30], [41], [52], [63], ['n/a'], ['unknown']]);

      expect(metrics.columns[0]).toMatchObject({
        inferredType: 'integer',
        inconsistent: true,
        inconsistentPercent: 33.33,
        typeCounts: { integer: 4, number: 0, boolean: 0, date: 0, string: 2 },
      });
    });

    it('does not call integers-plus-decimals inconsistent', () => {
      const metrics = profile(['price'], [[1], [2.5], ['3'], ['4.75']]);
      expect(metrics.columns[0]).toMatchObject({ inferredType: 'number', inconsistent: false, inconsistentPercent: 0 });
    });

    it('a column that is half text and half numbers is inconsistent either way', () => {
      const metrics = profile(['x'], [[1], [2], ['a'], ['b']]);
      expect(metrics.columns[0]).toMatchObject({ inconsistent: true, inconsistentPercent: 50 });
    });

    it('an error cell like #N/A in a numeric column shows up as a disagreement', () => {
      const metrics = profile(['x'], [[1], [2], [3], ['#N/A']]);
      expect(metrics.columns[0]).toMatchObject({ inferredType: 'integer', inconsistent: true, inconsistentPercent: 25 });
    });
  });

  describe('numeric statistics', () => {
    it('min, max and mean over the numeric cells only', () => {
      const metrics = profile(['n'], [[2], ['4'], [6], ['text'], [null]]);
      expect(metrics.columns[0]?.numeric).toEqual({ min: 2, max: 6, mean: 4 });
    });

    it('handles negatives and decimals', () => {
      const metrics = profile(['n'], [[-5], [2.5], [0]]);
      expect(metrics.columns[0]?.numeric).toEqual({ min: -5, max: 2.5, mean: -0.8333333333333334 });
    });

    it('is null for a column with no numbers', () => {
      expect(profile(['n'], [['a'], ['b']]).columns[0]?.numeric).toBeNull();
    });
  });

  describe('duplicates and empty rows', () => {
    it('counts each row identical to an EARLIER one', () => {
      const metrics = profile(['a', 'b'], [['1', 'x'], ['2', 'y'], ['1', 'x'], ['1', 'x'], ['2', 'y']]);
      expect(metrics.duplicateRows).toBe(3);
    });

    it('is case- and type-sensitive where it matters, and whitespace-insensitive where it does not', () => {
      const metrics = profile(['a'], [['Ada'], ['ada'], [' Ada '], [1], ['1']]);
      // ' Ada ' == 'Ada'; the number 1 and the text '1' are the same cell content.
      expect(metrics.duplicateRows).toBe(2);
    });

    it('rows differing only by column position are not duplicates', () => {
      expect(profile(['a', 'b'], [['x', 'y'], ['y', 'x']]).duplicateRows).toBe(0);
    });

    it('counts fully empty rows separately and never as duplicates of each other', () => {
      const metrics = profile(['a', 'b'], [['1', '2'], ['', ''], [null, null], ['1', '2']]);
      expect(metrics).toMatchObject({ emptyRows: 2, duplicateRows: 1, rowCount: 4 });
    });

    it('does not mistake a delimiter-joined collision for a duplicate', () => {
      expect(profile(['a', 'b'], [['x\u0001y', 'z'], ['x', 'y\u0001z']]).duplicateRows).toBe(0);
    });
  });

  describe('uniqueness tracking (for a unique rule)', () => {
    const track = (header: CellValue[], rows: CellValue[][], columns: string[]) => {
      const accumulator = new MetricsAccumulator(header, { uniqueColumns: new Set(columns) });
      for (const row of rows) accumulator.addRow(row);
      return accumulator.uniqueness();
    };

    it('counts each repeat of a value in a tracked column, and none for unique values', () => {
      expect(track(['id'], [['a'], ['b'], ['c']], ['id'])).toEqual({ id: 0 });
      expect(track(['id'], [['a'], ['b'], ['a'], ['a']], ['id'])).toEqual({ id: 2 });
    });

    it('never counts a blank as a repeat: a column may have many empty cells and still be unique', () => {
      expect(track(['id'], [['a'], [null], [''], ['  '], ['b']], ['id'])).toEqual({ id: 0 });
    });

    it('matches the column case-insensitively, and reports it under the lower-cased key', () => {
      expect(track(['Email'], [['x'], ['x']], ['email'])).toEqual({ email: 1 });
    });

    it('compares values as text, trimmed, case-sensitively', () => {
      expect(track(['v'], [['A'], ['a'], [' A ']], ['v'])).toEqual({ v: 1 });
    });

    it('tracks only the columns asked for', () => {
      expect(track(['a', 'b'], [['x', '1'], ['x', '1']], ['b'])).toEqual({ b: 1 });
      expect(track(['a'], [['x'], ['x']], [])).toEqual({});
    });

    it('does not change the metrics themselves', () => {
      const rows: CellValue[][] = [['a', 1], ['a', 2]];
      const plain = new MetricsAccumulator(['k', 'n']);
      const tracked = new MetricsAccumulator(['k', 'n'], { uniqueColumns: new Set(['k']) });
      for (const row of rows) {
        plain.addRow(row);
        tracked.addRow(row);
      }
      expect(tracked.finish()).toEqual(plain.finish());
    });
  });

  describe('the row budget', () => {
    it('stops at the budget, says so, and reports what it analysed', () => {
      const accumulator = new MetricsAccumulator(['a']);
      let accepted = 0;
      for (let i = 0; i < PROFILE_LIMITS.maxRows + 25; i += 1) {
        if (accumulator.addRow([String(i)])) accepted += 1;
      }
      const metrics = accumulator.finish();

      expect(accepted).toBe(PROFILE_LIMITS.maxRows);
      expect(metrics).toMatchObject({ rowCount: PROFILE_LIMITS.maxRows, truncated: true, rowBudget: PROFILE_LIMITS.maxRows });
    });

    it('a file exactly at the budget is not truncated', () => {
      const accumulator = new MetricsAccumulator(['a']);
      for (let i = 0; i < PROFILE_LIMITS.maxRows; i += 1) accumulator.addRow([String(i)]);
      expect(accumulator.finish().truncated).toBe(false);
    });
  });

  it('profiles only the first columns of an absurdly wide file, and says so', () => {
    const wide = Array.from({ length: PROFILE_LIMITS.maxColumns + 50 }, (_, i) => `c${i}`);
    const metrics = profile(wide, []);

    expect(metrics.columnCount).toBe(PROFILE_LIMITS.maxColumns);
    expect(metrics.headerIssues.join(' ')).toMatch(/only the first 200/);
  });

  it('produces JSON that round-trips exactly (it is stored as jsonb)', () => {
    const metrics = profile(['a', 'b'], [[1, 'x'], [2.5, 'y'], [null, 'x']]);
    expect(JSON.parse(JSON.stringify(metrics))).toEqual(metrics);
  });
});
