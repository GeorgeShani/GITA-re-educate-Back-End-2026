import { describe, expect, it } from 'vitest';
import { csvBytes, realXlsxBytes, xlsBytes, zipBytes } from '#test/support/spreadsheet-fixtures.js';
import { CSV_MIME, XLSX_MIME, XLS_MIME } from '../spreadsheet-types.js';
import {
  MAX_UNCOMPRESSED_XLSX_BYTES,
  UnreadableFileError,
  UnsupportedFormatError,
  detectDelimiter,
  normaliseExcelCell,
  readSpreadsheet,
} from './spreadsheet-reader.js';
import { summariseZip } from './zip-guard.js';

const LIMITS = { maxRows: 1_000, maxColumns: 50 };
const read = (text: string, limits = LIMITS) => readSpreadsheet(Buffer.from(text), CSV_MIME, limits);

describe('CSV', () => {
  it('reads a header and rows', async () => {
    expect(await readSpreadsheet(csvBytes(), CSV_MIME, LIMITS)).toEqual({
      header: ['id', 'name'],
      rows: [['1', 'Ada'], ['2', 'Grace']],
      truncated: false,
      columnCount: 2,
    });
  });

  it('handles a byte-order mark, CRLF, quoted commas and quoted newlines', async () => {
    const sheet = await readSpreadsheet(
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('name,note\r\n"Nino, K.","line1\nline2"\r\nGio,ok\r\n')]),
      CSV_MIME,
      LIMITS,
    );

    expect(sheet.header).toEqual(['name', 'note']);
    expect(sheet.rows).toEqual([['Nino, K.', 'line1\nline2'], ['Gio', 'ok']]);
  });

  it('tolerates ragged rows and a quote in the middle of a field', async () => {
    const sheet = await read('a,b,c\n1,2\n1,2,3,4\n5,6" inches,7\n');

    expect(sheet.rows[0]).toEqual(['1', '2']);
    expect(sheet.rows[1]).toEqual(['1', '2', '3', '4']);
    expect(sheet.rows[2]).toEqual(['5', '6" inches', '7']);
  });

  it('a quote that is opened and never closed makes the file unreadable, with the reason', async () => {
    // It would swallow every row after it, so guessing would report wrong numbers.
    await expect(read('a,b\n1,"never closed\n2,3\n')).rejects.toThrow(/could not be parsed as CSV.*Quote Not Closed/);
  });

  it('skips blank lines', async () => {
    expect((await read('a\n\n1\n\n\n2\n')).rows).toEqual([['1'], ['2']]);
  });

  it('reads non-ASCII text', async () => {
    expect((await read('სახელი\nნინო\n')).rows).toEqual([['ნინო']]);
  });

  it('a header-only file has no rows', async () => {
    expect(await read('a,b\n')).toMatchObject({ header: ['a', 'b'], rows: [], truncated: false });
  });

  it('cuts at the row budget and says so — but not when the file is exactly that long', async () => {
    const body = (n: number) => 'id\n' + Array.from({ length: n }, (_, i) => String(i)).join('\n');

    expect(await read(body(10), { maxRows: 10, maxColumns: 5 })).toMatchObject({ truncated: false });
    const cut = await read(body(11), { maxRows: 10, maxColumns: 5 });
    expect(cut.truncated).toBe(true);
    expect(cut.rows).toHaveLength(10);
  });

  it('cuts wide files to the column budget but reports the true width', async () => {
    const sheet = await read('a,b,c,d,e,f\n1,2,3,4,5,6\n', { maxRows: 10, maxColumns: 3 });

    expect(sheet.header).toEqual(['a', 'b', 'c']);
    expect(sheet.rows[0]).toEqual(['1', '2', '3']);
    expect(sheet.columnCount).toBe(6);
  });

  it('rejects invalid UTF-8 and an empty file', async () => {
    await expect(readSpreadsheet(Buffer.from([0x61, 0xe9, 0x0a]), CSV_MIME, LIMITS)).rejects.toBeInstanceOf(UnreadableFileError);
    await expect(read('')).rejects.toBeInstanceOf(UnreadableFileError);
  });

  describe('detectDelimiter', () => {
    it.each([
      ['a,b,c', ','],
      ['a;b;c', ';'],
      ['a\tb\tc', '\t'],
      ['a|b|c', '|'],
      ['single', ','],
      ['"a;b",c,d', ','],
      ['a;b;c,d', ';'],
    ])('%j → %j', (line, expected) => {
      expect(detectDelimiter(line)).toBe(expected);
    });

    it('reads a semicolon file as columns', async () => {
      expect((await read('a;b\n1;2\n')).rows).toEqual([['1', '2']]);
    });
  });
});

describe('XLSX', () => {
  it('reads a real workbook written by exceljs, with dates, numbers and booleans intact', async () => {
    const bytes = await realXlsxBytes([
      ['id', 'name', 'when', 'ok', 'score'],
      [1, 'Ada', new Date('2026-01-02T00:00:00Z'), true, 1.5],
      [2, 'Grace', new Date('2026-02-03T00:00:00Z'), false, 2],
    ]);

    const sheet = await readSpreadsheet(bytes, XLSX_MIME, LIMITS);

    expect(sheet.header).toEqual(['id', 'name', 'when', 'ok', 'score']);
    expect(sheet.rows).toEqual([
      [1, 'Ada', new Date('2026-01-02T00:00:00Z'), true, 1.5],
      [2, 'Grace', new Date('2026-02-03T00:00:00Z'), false, 2],
    ]);
    expect(sheet.truncated).toBe(false);
  });

  it('reads the first sheet that has data, ignoring later ones', async () => {
    const sheet = await readSpreadsheet(await realXlsxBytes([['a'], [1]], { extraSheets: true }), XLSX_MIME, LIMITS);
    expect(sheet.header).toEqual(['a']);
  });

  it('turns formulas, hyperlinks, rich text and errors into plain cells', async () => {
    const bytes = await realXlsxBytes([
      ['a', 'b', 'c', 'd'],
      [{ formula: '1+1', result: 2 }, { text: 'click', hyperlink: 'http://x.test' }, { richText: [{ text: 'Rich ' }, { text: 'text' }] }, { error: '#DIV/0!' }],
    ]);

    const [row] = (await readSpreadsheet(bytes, XLSX_MIME, LIMITS)).rows;

    expect(row).toEqual([2, 'click', 'Rich text', '#DIV/0!']);
  });

  it('keeps blank cells as null', async () => {
    const [row] = (await readSpreadsheet(await realXlsxBytes([['a', 'b', 'c'], [1, null, 3]]), XLSX_MIME, LIMITS)).rows;
    expect(row).toEqual([1, null, 3]);
  });

  it('cuts at the row budget', async () => {
    const rows: unknown[][] = [['n'], ...Array.from({ length: 30 }, (_, i) => [i])];
    const sheet = await readSpreadsheet(await realXlsxBytes(rows), XLSX_MIME, { maxRows: 10, maxColumns: 5 });

    expect(sheet.rows).toHaveLength(10);
    expect(sheet.truncated).toBe(true);
  });

  it('rejects a ZIP that is not a workbook, and garbage, as unreadable — not as a crash', async () => {
    await expect(readSpreadsheet(zipBytes([['readme.txt', 'hi']]), XLSX_MIME, LIMITS)).rejects.toBeInstanceOf(UnreadableFileError);
    await expect(readSpreadsheet(Buffer.from('not a zip at all'), XLSX_MIME, LIMITS)).rejects.toBeInstanceOf(UnreadableFileError);
  });

  it('refuses a "zip bomb": a small archive that claims to inflate past the budget, without inflating it', async () => {
    const bomb = await realXlsxBytes([['a'], [1]]);
    forgeUncompressedSize(bomb, MAX_UNCOMPRESSED_XLSX_BYTES + 1);

    await expect(readSpreadsheet(bomb, XLSX_MIME, LIMITS)).rejects.toThrow(/more data than can be profiled safely/);
  });
});

describe('XLS', () => {
  it('is stored but not profiled, and says why', async () => {
    await expect(readSpreadsheet(xlsBytes(), XLS_MIME, LIMITS)).rejects.toBeInstanceOf(UnsupportedFormatError);
    await expect(readSpreadsheet(xlsBytes(), XLS_MIME, LIMITS)).rejects.toThrow(/\.xlsx or \.csv/);
  });
});

describe('normaliseExcelCell', () => {
  it.each<[unknown, unknown]>([
    [null, null],
    [undefined, null],
    ['x', 'x'],
    [3, 3],
    [true, true],
    [Number.NaN, null],
    [{ text: 'a' }, 'a'],
    [{ text: { richText: [{ text: 'a' }, { text: 'b' }] } }, 'ab'],
    [{ formula: 'A1', result: { error: '#REF!' } }, '#REF!'],
    [{ formula: 'A1' }, null],
    [{ unexpected: 'shape' }, null],
    [[1, 2], null],
  ])('%j → %j', (cell, expected) => {
    expect(normaliseExcelCell(cell)).toEqual(expected);
  });

  it('an invalid Date is null', () => {
    expect(normaliseExcelCell(new Date('nope'))).toBeNull();
  });

  it('does not recurse forever on a formula whose result is a formula', () => {
    const nested = { formula: 'x', result: { formula: 'y', result: { formula: 'z', result: { formula: 'w', result: { formula: 'v', result: 1 } } } } };
    expect(normaliseExcelCell(nested)).toBeNull();
  });
});

describe('summariseZip', () => {
  it('sums the central directory without inflating anything', () => {
    const zip = zipBytes([['a.txt', 'x'.repeat(100)], ['b.txt', 'y'.repeat(50)]]);
    expect(summariseZip(zip)).toEqual({ entries: 2, uncompressedBytes: 150 });
  });

  it('treats ZIP64 sizes as beyond any budget', () => {
    const zip = zipBytes([['a.txt', 'x']]);
    forgeUncompressedSize(zip, 0xffffffff);
    expect(summariseZip(zip)?.uncompressedBytes).toBe(Number.POSITIVE_INFINITY);
  });

  it.each([
    ['too short', Buffer.alloc(10)],
    ['no end record', Buffer.alloc(200)],
    ['plain text', Buffer.from('hello world, this is not a zip file at all, just text.')],
  ])('returns null for %s', (_name, bytes) => {
    expect(summariseZip(bytes)).toBeNull();
  });

  it('returns null, not an exception, when the directory points outside the file', () => {
    const zip = zipBytes([['a.txt', 'x']]);
    zip.writeUInt32LE(0x7fffffff, zip.length - 22 + 16); // central directory offset
    expect(summariseZip(zip)).toBeNull();
  });
});

/** Rewrites the FIRST central-directory entry's claimed uncompressed size, in place. */
function forgeUncompressedSize(zip: Buffer, size: number): void {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const directory = zip.readUInt32LE(end + 16);
  zip.writeUInt32LE(size, directory + 24);
}
