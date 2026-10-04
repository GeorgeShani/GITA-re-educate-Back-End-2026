import { describe, expect, it } from 'vitest';
import type { CellValue } from '../quality/metrics.js';
import { applyRecipe } from './engine.js';
import { type Recipe, recipeSchema } from './recipe.js';

const context = { hashKey: Buffer.from('test-key-for-hashing-only-0123456') };

function run(header: string[], rows: CellValue[][], steps: unknown[]) {
  const recipe: Recipe = recipeSchema.parse({ steps });
  return applyRecipe({ header, rows }, recipe, context);
}

describe('the recipe', () => {
  it('fills in defaults, and refuses what it does not know', () => {
    expect(recipeSchema.parse({ steps: [{ step: 'standardise_dates', column: 'when' }] }).steps[0]).toEqual({
      step: 'standardise_dates',
      column: 'when',
      order: 'dmy',
    });
    expect(recipeSchema.safeParse({ steps: [{ step: 'run_script' }] }).success).toBe(false);
    expect(recipeSchema.safeParse({ steps: [] }).success).toBe(false);
    expect(recipeSchema.safeParse({ steps: Array.from({ length: 51 }, () => ({ step: 'drop_empty_rows' })) }).success).toBe(false);
    expect(recipeSchema.safeParse({ steps: [{ step: 'drop_column', column: 'a', extra: 1 }] }).success).toBe(true);
  });
});

describe('applyRecipe', () => {
  it('never changes its input', () => {
    const rows: CellValue[][] = [[' Ada '], [' Ada ']];
    run(['name'], rows, [{ step: 'trim_whitespace' }, { step: 'drop_duplicate_rows' }]);
    expect(rows).toEqual([[' Ada '], [' Ada ']]);
  });

  it('trims spaces at the ends and runs of spaces inside, one column or all', () => {
    const result = run(['name', 'city'], [['  Ada   Lovelace ', ' London'], ['Grace', 'Arlington']], [{ step: 'trim_whitespace', column: 'NAME' }]);
    expect(result.rows).toEqual([['Ada Lovelace', ' London'], ['Grace', 'Arlington']]);
    expect(result.steps[0]).toMatchObject({ changed: 1, skipped: null });

    expect(run(['name', 'city'], [['  a ', ' b ']], [{ step: 'trim_whitespace' }]).rows).toEqual([['a', 'b']]);
  });

  it('tidies the header row', () => {
    const result = run([' First   name ', 'age'], [['Ada', 1]], [{ step: 'tidy_headers' }]);
    expect(result.header).toEqual(['First name', 'age']);
    expect(result.steps[0]?.changed).toBe(1);
  });

  it('removes empty rows, counting spaces as empty', () => {
    const result = run(['a', 'b'], [['x', 1], [null, '  '], ['', null], ['y', 2]], [{ step: 'drop_empty_rows' }]);
    expect(result.rows).toEqual([['x', 1], ['y', 2]]);
    expect(result.steps[0]?.changed).toBe(2);
    expect(result.rowsBefore).toBe(4);
    expect(result.rowsAfter).toBe(2);
  });

  it('removes repeats and keeps the first; running it after a trim also finds rows that differed only by spaces', () => {
    const rows: CellValue[][] = [['Ada', 1], ['Ada ', 1], ['Grace', 2], ['Ada', 1]];
    expect(run(['n', 'v'], rows, [{ step: 'drop_duplicate_rows' }]).rows).toEqual([['Ada', 1], ['Grace', 2]]);
    const both = run(['n', 'v'], rows, [{ step: 'trim_whitespace' }, { step: 'drop_duplicate_rows' }]);
    expect(both.rows).toEqual([['Ada', 1], ['Grace', 2]]);
    expect(both.steps.map((step) => step.changed)).toEqual([1, 2]);
  });

  it('does not call rows duplicates because one cell ends where the next begins', () => {
    expect(run(['a', 'b'], [['x\u0001y', 'z'], ['x', 'y\u0001z']], [{ step: 'drop_duplicate_rows' }]).rows).toHaveLength(2);
  });

  it('writes dates as dates, says what it could not read, and what could be read either way', () => {
    const result = run(
      ['when'],
      [['25/12/2025'], ['03/04/2026'], ['soon'], [''], ['2026-01-02']],
      [{ step: 'standardise_dates', column: 'when', order: 'dmy' }],
    );
    expect(result.rows.map((row) => (row[0] instanceof Date ? row[0].toISOString().slice(0, 10) : row[0]))).toEqual([
      '2025-12-25',
      '2026-04-03',
      'soon',
      '',
      '2026-01-02',
    ]);
    expect(result.steps[0]?.changed).toBe(3);
    expect(result.steps[0]?.notes.join(' ')).toMatch(/1 date like 03\/04\/2026.*day first/);
    expect(result.steps[0]?.notes.join(' ')).toMatch(/1 value could not be read as a date/);
  });

  it('reads numbers written in the other style', () => {
    const result = run(['price'], [['1.234,50 €'], ['99'], ['n/a'], [7]], [{ step: 'parse_numbers', column: 'price', decimal: ',' }]);
    expect(result.rows).toEqual([[1234.5], [99], ['n/a'], [7]]);
    expect(result.steps[0]?.changed).toBe(2);
    expect(result.steps[0]?.notes[0]).toMatch(/1 value could not be read as a number/);
  });

  it('replaces placeholders with nothing, or with a value, ignoring case and spaces', () => {
    const rows: CellValue[][] = [['N/A', 'ok'], [' null ', 'n/a'], ['fine', '-']];
    expect(run(['a', 'b'], rows, [{ step: 'replace_values', values: ['n/a', 'null', '-'] }]).rows).toEqual([[null, 'ok'], [null, null], ['fine', null]]);
    expect(run(['a', 'b'], rows, [{ step: 'replace_values', column: 'a', values: ['N/A'], with: 'unknown' }]).rows[0]).toEqual(['unknown', 'ok']);
  });

  it('fills empties, changes case, renames and drops columns', () => {
    const result = run(
      ['name', 'country', 'note'],
      [['ada LOVELACE', null, 'x'], ['grace hopper', 'us', 'y']],
      [
        { step: 'fill_empty', column: 'country', value: 'unknown' },
        { step: 'change_case', column: 'name', mode: 'title' },
        { step: 'change_case', column: 'country', mode: 'upper' },
        { step: 'rename_column', column: 'name', to: 'full_name' },
        { step: 'drop_column', column: 'note' },
      ],
    );
    expect(result.header).toEqual(['full_name', 'country']);
    expect(result.rows).toEqual([['Ada Lovelace', 'UNKNOWN'], ['Grace Hopper', 'US']]);
  });

  it('will not rename a column onto the name of another', () => {
    const result = run(['a', 'b'], [[1, 2]], [{ step: 'rename_column', column: 'a', to: 'B' }]);
    expect(result.header).toEqual(['a', 'b']);
    expect(result.steps[0]?.skipped).toMatch(/already has a column called "B"/);
  });

  it('skips a step about a column the file does not have, and does the rest', () => {
    const result = run(['a'], [[' x ']], [{ step: 'drop_column', column: 'ghost' }, { step: 'trim_whitespace' }]);
    expect(result.steps[0]).toMatchObject({ changed: 0, skipped: 'The column "ghost" is not in this file.' });
    expect(result.rows).toEqual([['x']]);
  });

  describe('masking', () => {
    const rows: CellValue[][] = [['4111111111111111'], [''], ['ab']];
    it('hides, keeps the last four, or makes a stable fingerprint', () => {
      expect(run(['card'], rows, [{ step: 'mask_column', column: 'card', mode: 'redact' }]).rows).toEqual([['[hidden]'], [''], ['[hidden]']]);
      expect(run(['card'], rows, [{ step: 'mask_column', column: 'card', mode: 'last4' }]).rows).toEqual([['************1111'], [''], ['**']]);
      const hashed = run(['card'], [['same'], ['same'], ['other']], [{ step: 'mask_column', column: 'card', mode: 'hash' }]).rows;
      expect(hashed[0]).toEqual(hashed[1]);
      expect(hashed[0]).not.toEqual(hashed[2]);
      expect(String(hashed[0]?.[0])).toMatch(/^[0-9a-f]{16}$/);
    });

    it('a fingerprint depends on the key, so guessing values cannot rebuild it', () => {
      const a = applyRecipe({ header: ['x'], rows: [['v']] }, recipeSchema.parse({ steps: [{ step: 'mask_column', column: 'x', mode: 'hash' }] }), { hashKey: Buffer.from('one') });
      const b = applyRecipe({ header: ['x'], rows: [['v']] }, recipeSchema.parse({ steps: [{ step: 'mask_column', column: 'x', mode: 'hash' }] }), { hashKey: Buffer.from('two') });
      expect(a.rows).not.toEqual(b.rows);
    });
  });

  describe('the preview samples', () => {
    it('lists the rows that changed, with the cell before and after, and the number each had in the file', () => {
      const result = run(['name'], [['a'], [' b '], ['c'], [' d']], [{ step: 'trim_whitespace' }]);
      expect(result.samples).toEqual([
        { row: 3, cells: [{ before: ' b ', after: 'b' }] },
        { row: 5, cells: [{ before: ' d', after: 'd' }] },
      ]);
    });

    it('follows rows and columns through removals', () => {
      const result = run(
        ['keep', 'gone'],
        [['x', 1], ['x', 1], [' y', 2]],
        [{ step: 'drop_duplicate_rows' }, { step: 'drop_column', column: 'gone' }, { step: 'trim_whitespace' }],
      );
      expect(result.samples).toEqual([{ row: 4, cells: [{ before: ' y', after: 'y' }] }]);
    });

    it('keeps no more than asked for', () => {
      const rows: CellValue[][] = Array.from({ length: 50 }, () => [' x ']);
      const result = applyRecipe({ header: ['a'], rows }, recipeSchema.parse({ steps: [{ step: 'trim_whitespace' }] }), { ...context, sampleSize: 5 });
      expect(result.samples).toHaveLength(5);
    });
  });
});
