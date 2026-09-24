import { fileTypeFromBuffer } from 'file-type';
import { parse } from 'csv-parse/sync';
import { isExcelWorkbook } from './cfb.js';
import { CSV_MIME, type SpreadsheetMime, XLSX_MIME, XLS_MIME } from '../spreadsheet-types.js';

/** How much of a text file the CSV check reads and parses; the rest is only checked for validity. */
const CSV_SAMPLE_BYTES = 64 * 1024;
const CSV_SAMPLE_RECORDS = 100;
/** C0 control characters that never appear in a delimited text file (tab, LF, CR are fine). */
// eslint-disable-next-line no-control-regex
const BINARY_CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/;

/**
 * What these bytes really are: `text/csv`, `.xls`, `.xlsx`, or `null` for anything
 * else. The extension and `Content-Type` a client sends are never consulted — a
 * Windows executable renamed `report.csv` and sent as `text/csv` is `null`.
 *
 * - **xlsx**: `file-type` sees the ZIP and its `[Content_Types].xml` say spreadsheet.
 * - **xls**: `file-type` sees an OLE compound file (`cfb`), and it must hold a
 *   `Workbook`/`Book` stream, because Word and MSI files are compound files too.
 * - **csv**: has no magic bytes at all. `file-type` must find NOTHING (any recognised
 *   binary format disqualifies it), then a text sniff must pass: valid UTF-8, no NUL
 *   or other binary control characters, and the first rows parse as delimited text.
 *
 * Memoised per buffer, so the pipe that validates an upload and the service that
 * records its type do the work once.
 */
const cache = new WeakMap<Uint8Array, Promise<SpreadsheetMime | null>>();

export function sniffSpreadsheet(bytes: Uint8Array): Promise<SpreadsheetMime | null> {
  let result = cache.get(bytes);
  if (!result) {
    result = detect(bytes);
    cache.set(bytes, result);
  }
  return result;
}

async function detect(bytes: Uint8Array): Promise<SpreadsheetMime | null> {
  if (bytes.length === 0) return null;

  const detected = await fileTypeFromBuffer(bytes);
  if (detected) {
    if (detected.ext === 'xlsx') return XLSX_MIME;
    if (detected.ext === 'cfb') return isExcelWorkbook(bytes) ? XLS_MIME : null;
    return null;
  }
  return looksLikeCsv(bytes) ? CSV_MIME : null;
}

export function looksLikeCsv(bytes: Uint8Array): boolean {
  // NUL is the cheapest, surest sign of a binary file.
  if (bytes.indexOf(0) !== -1) return false;

  let text: string;
  try {
    // `fatal` makes invalid UTF-8 throw; a BOM is allowed and stripped.
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let sample = text.slice(0, CSV_SAMPLE_BYTES);
  if (text.length > CSV_SAMPLE_BYTES) {
    // Do not parse a row cut in half.
    const lastNewline = sample.lastIndexOf('\n');
    if (lastNewline > 0) sample = sample.slice(0, lastNewline);
  }
  if (BINARY_CONTROL.test(sample)) return false;

  try {
    const records: unknown = parse(sample, {
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      to: CSV_SAMPLE_RECORDS,
    });
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}
