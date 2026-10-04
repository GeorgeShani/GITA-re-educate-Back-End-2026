import { describe, expect, it } from 'vitest';
import { CSV_MIME, XLS_MIME, XLSX_MIME } from '../spreadsheet-types.js';
import { readSpreadsheet } from '../parsing/spreadsheet-reader.js';
import { writeCsv, writeSheet, writeXlsx } from './sheet-writer.js';

const LIMITS = { maxRows: 1000, maxColumns: 50 };

describe('writeCsv', () => {
  it('quotes only what needs it, and writes dates as days', () => {
    const text = writeCsv(['name', 'note', 'when'], [
      ['Ada', 'says "hi", twice', new Date('2026-03-04T00:00:00Z')],
      ['Grace', ' padded ', new Date('2026-03-04T10:30:00Z')],
      ['Line', 'one\ntwo', null],
    ]).toString('utf8');
    expect(text).toBe(
      'name,note,when\r\nAda,"says ""hi"", twice",2026-03-04\r\nGrace," padded ",2026-03-04T10:30:00.000Z\r\nLine,"one\ntwo",\r\n',
    );
  });

  it('reads back as the same table', async () => {
    const rows = [['Ada', 'a, b', 1.5], ['Grace', 'say "x"', ''], ['Multi', 'line\nbreak', 2]];
    const back = await readSpreadsheet(writeCsv(['name', 'note', 'n'], rows), CSV_MIME, LIMITS);
    expect(back.header).toEqual(['name', 'note', 'n']);
    expect(back.rows).toEqual([['Ada', 'a, b', '1.5'], ['Grace', 'say "x"', ''], ['Multi', 'line\nbreak', '2']]);
  });
});

describe('writeXlsx', () => {
  it('keeps numbers numbers and dates dates', async () => {
    const bytes = await writeXlsx(['n', 'when', 'text'], [[1.5, new Date('2026-03-04T00:00:00Z'), 'x']], 'Cleaned');
    const back = await readSpreadsheet(bytes, XLSX_MIME, LIMITS);
    expect(back.sheet?.name).toBe('Cleaned');
    expect(back.rows[0]?.[0]).toBe(1.5);
    expect(back.rows[0]?.[1]).toEqual(new Date('2026-03-04T00:00:00Z'));
    expect(back.rows[0]?.[2]).toBe('x');
  });

  it('gives a sheet a name Excel accepts', async () => {
    const back = await readSpreadsheet(await writeXlsx(['a'], [[1]], 'Q1/Q2: [final]?*'), XLSX_MIME, LIMITS);
    expect(back.sheet?.name).toBe('Q1 Q2 final');
    const empty = await readSpreadsheet(await writeXlsx(['a'], [[1]], '////'), XLSX_MIME, LIMITS);
    expect(empty.sheet?.name).toBe('Sheet1');
  });
});

describe('writeSheet', () => {
  it('keeps a CSV a CSV, and turns a workbook (or a legacy .xls) into an .xlsx', async () => {
    expect((await writeSheet(CSV_MIME, ['a'], [[1]], 'x')).extension).toBe('csv');
    expect(await writeSheet(XLSX_MIME, ['a'], [[1]], 'x')).toMatchObject({ extension: 'xlsx', mime: XLSX_MIME });
    expect(await writeSheet(XLS_MIME, ['a'], [[1]], 'x')).toMatchObject({ extension: 'xlsx', mime: XLSX_MIME });
  });
});
