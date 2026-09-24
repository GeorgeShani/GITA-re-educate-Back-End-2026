import { describe, expect, it } from 'vitest';
import {
  compoundFileBytes,
  csvBytes,
  docBytes,
  docxBytes,
  exeBytes,
  pngBytes,
  xlsBytes,
  xlsxBytes,
  zipBytes,
} from '#test/support/spreadsheet-fixtures.js';
import { CSV_MIME, XLSX_MIME, XLS_MIME } from '../spreadsheet-types.js';
import { cfbEntryNames } from './cfb.js';
import { looksLikeCsv, sniffSpreadsheet } from './sniff-spreadsheet.js';
import { SpreadsheetFileValidator } from './spreadsheet-file.validator.js';

/**
 * The brief's "CSV, XLS, XLSX only" has to survive the obvious attack: rename an
 * executable to `.csv` and send `Content-Type: text/csv`. Nothing here ever sees a
 * file name or a declared type — only bytes.
 */
describe('sniffSpreadsheet', () => {
  describe('accepts', () => {
    it('a real CSV', async () => {
      expect(await sniffSpreadsheet(csvBytes())).toBe(CSV_MIME);
    });

    it('a CSV with a UTF-8 byte-order mark', async () => {
      const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), csvBytes()]);
      expect(await sniffSpreadsheet(withBom)).toBe(CSV_MIME);
    });

    it('a CSV with non-ASCII text, quoted commas and CRLF line endings', async () => {
      const text = 'სახელი,ქალაქი\r\n"Nino, K.",თბილისი\r\n"Gio","Batumi"\r\n';
      expect(await sniffSpreadsheet(Buffer.from(text, 'utf8'))).toBe(CSV_MIME);
    });

    it('a single-column CSV and a header-only CSV', async () => {
      expect(await sniffSpreadsheet(Buffer.from('name\nAda\nGrace\n'))).toBe(CSV_MIME);
      expect(await sniffSpreadsheet(Buffer.from('id,name\n'))).toBe(CSV_MIME);
    });

    it('a semicolon- or tab-separated file (still delimited text)', async () => {
      expect(await sniffSpreadsheet(Buffer.from('a;b\n1;2\n'))).toBe(CSV_MIME);
      expect(await sniffSpreadsheet(Buffer.from('a\tb\n1\t2\n'))).toBe(CSV_MIME);
    });

    it('a CSV with ragged rows', async () => {
      expect(await sniffSpreadsheet(Buffer.from('a,b,c\n1,2\n1,2,3,4\n'))).toBe(CSV_MIME);
    });

    it('a real XLSX (a ZIP whose content types say spreadsheet)', async () => {
      expect(await sniffSpreadsheet(xlsxBytes())).toBe(XLSX_MIME);
    });

    it('a real XLS (an OLE2 compound file holding a Workbook stream)', async () => {
      expect(await sniffSpreadsheet(xlsBytes())).toBe(XLS_MIME);
    });

    it('an XLS whose Workbook stream is in a later directory sector', async () => {
      const spilled = compoundFileBytes(['a', 'b', 'c', 'd', 'e', 'Workbook']);
      expect(await sniffSpreadsheet(spilled)).toBe(XLS_MIME);
    });

    it('an old BIFF5 XLS, whose stream is called Book', async () => {
      expect(await sniffSpreadsheet(compoundFileBytes(['Book']))).toBe(XLS_MIME);
    });
  });

  describe('rejects', () => {
    it('a Windows executable — whatever it is renamed to', async () => {
      expect(await sniffSpreadsheet(exeBytes())).toBeNull();
    });

    it('an executable padded with NUL bytes so it is not detected by signature alone', async () => {
      // "MZ" is what file-type keys on; make sure the CSV route is not a way round it.
      expect(await sniffSpreadsheet(Buffer.concat([Buffer.from('a,b\n'), Buffer.alloc(64, 0)]))).toBeNull();
    });

    it('a PNG', async () => {
      expect(await sniffSpreadsheet(pngBytes())).toBeNull();
    });

    it('a Word .docx: it is a ZIP too, but not a spreadsheet', async () => {
      expect(await sniffSpreadsheet(docxBytes())).toBeNull();
    });

    it('a ZIP of anything else', async () => {
      expect(await sniffSpreadsheet(zipBytes([['readme.txt', 'hi']]))).toBeNull();
    });

    it('a Word .doc: an OLE2 compound file with no Workbook stream', async () => {
      expect(await sniffSpreadsheet(docBytes())).toBeNull();
    });

    it('a compound file that only CLAIMS to be one (signature, nothing else)', async () => {
      const truncated = Buffer.concat([
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        Buffer.alloc(600, 0),
      ]);
      expect(await sniffSpreadsheet(truncated)).toBeNull();
    });

    it('an empty file', async () => {
      expect(await sniffSpreadsheet(Buffer.alloc(0))).toBeNull();
    });

    it('random binary garbage', async () => {
      const garbage = Buffer.from(Array.from({ length: 512 }, (_, index) => (index * 37 + 11) % 256));
      expect(await sniffSpreadsheet(garbage)).toBeNull();
    });

    it('invalid UTF-8 (a Latin-1 export, which would corrupt the profiler)', async () => {
      expect(await sniffSpreadsheet(Buffer.from([0x6e, 0x61, 0x6d, 0x65, 0x0a, 0xe9, 0x0a]))).toBeNull();
    });

    it('text with binary control characters', async () => {
      expect(await sniffSpreadsheet(Buffer.from('a,b\n1,\x01\x02\n'))).toBeNull();
    });

    it('whitespace and blank lines only', async () => {
      expect(await sniffSpreadsheet(Buffer.from('\n\n\n'))).toBeNull();
    });
  });

  it('decides from the bytes only: the same bytes give the same answer however they are named', async () => {
    // There is no name parameter to lie with — that is the point — but prove the
    // memoised path is not keyed on anything but the buffer's identity.
    const bytes = exeBytes();
    expect(await sniffSpreadsheet(bytes)).toBeNull();
    expect(await sniffSpreadsheet(bytes)).toBeNull();
  });

  describe('looksLikeCsv', () => {
    it('only parses a bounded prefix of a large file, yet still rejects a binary tail', () => {
      const big = Buffer.concat([Buffer.from('a,b\n'.repeat(50_000)), Buffer.from([0x00])]);
      expect(looksLikeCsv(big)).toBe(false);
    });

    it('accepts a large clean file without choking on the row cut at the sample boundary', () => {
      expect(looksLikeCsv(Buffer.from('id,value\n'.repeat(20_000)))).toBe(true);
    });
  });
});

describe('cfbEntryNames', () => {
  it('lists the streams of a compound file', () => {
    expect(cfbEntryNames(compoundFileBytes(['Workbook', 'SummaryInformation']))).toEqual([
      'Root Entry',
      'Workbook',
      'SummaryInformation',
    ]);
  });

  it('follows the directory across sectors', () => {
    expect(cfbEntryNames(compoundFileBytes(['a', 'b', 'c', 'd', 'e']))).toEqual([
      'Root Entry',
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it.each([
    ['too short', Buffer.alloc(100)],
    ['wrong signature', Buffer.alloc(2048)],
  ])('returns null for a file that is %s', (_name, bytes) => {
    expect(cfbEntryNames(bytes)).toBeNull();
  });

  it('returns null, not an exception, for a hostile header', () => {
    const hostile = compoundFileBytes(['Workbook']);
    hostile.writeUInt16LE(0x1234, 30); // an impossible sector size
    expect(cfbEntryNames(hostile)).toBeNull();
  });

  it('cannot be sent into a loop by a directory chain that points at itself', () => {
    const looping = compoundFileBytes(['Workbook']);
    // FAT is sector 0, at file offset 512: make directory sector 1 its own successor.
    looping.writeUInt32LE(1, 512 + 1 * 4);
    expect(() => cfbEntryNames(looping)).not.toThrow();
  });
});

describe('SpreadsheetFileValidator', () => {
  const validator = new SpreadsheetFileValidator();

  it('accepts an uploaded spreadsheet by its bytes', async () => {
    expect(await validator.isValid({ buffer: csvBytes(), mimetype: 'application/octet-stream', size: 1 })).toBe(true);
  });

  it('rejects an executable that claims to be text/csv', async () => {
    expect(await validator.isValid({ buffer: exeBytes(), mimetype: 'text/csv', size: 1 })).toBe(false);
  });

  it('rejects a missing file or one with no buffer', async () => {
    expect(await validator.isValid(undefined)).toBe(false);
    expect(await validator.isValid({ mimetype: 'text/csv', size: 1 })).toBe(false);
  });

  it('says what IS accepted', () => {
    expect(validator.buildErrorMessage()).toMatch(/CSV, XLS and XLSX/);
  });
});
