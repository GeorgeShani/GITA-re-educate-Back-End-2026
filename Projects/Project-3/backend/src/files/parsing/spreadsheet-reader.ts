import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { CSV_MIME, type SpreadsheetMime, XLS_MIME, XLSX_MIME } from '../spreadsheet-types.js';
import type { CellValue } from '../quality/metrics.js';
import { summariseZip } from './zip-guard.js';

/** The file is one Gridline accepts but cannot be profiled (corrupt, or too large to open safely). */
export class UnreadableFileError extends Error {}
/** A format Gridline stores but does not profile: legacy `.xls`. */
export class UnsupportedFormatError extends Error {}

/**
 * Inflated `.xlsx` content above this is not opened. The compressed upload is capped at
 * 25 MB, but the XML inside can be hundreds of times larger, and the workbook loader
 * builds objects for all of it. ~200 MB covers every realistic 25 MB export.
 */
export const MAX_UNCOMPRESSED_XLSX_BYTES = 200 * 1024 * 1024;

export interface ReadLimits {
  /** Data rows to read (the header is extra). */
  maxRows: number;
  maxColumns: number;
}

export interface ParsedSheet {
  /** The first row. */
  header: CellValue[];
  /** Data rows, at most `maxRows`, each cut to `maxColumns`. */
  rows: CellValue[][];
  /** More data rows existed than were read. */
  truncated: boolean;
  /** How wide the header really was, before the column cut. */
  columnCount: number;
}

/**
 * Reads the first sheet (or the CSV) into plain rows of normalised cells. All format
 * differences end here: the profiler downstream never knows what the file was.
 *
 * `.xls` (legacy BIFF) is deliberately unsupported: the only maintained parsers for it
 * carry a history of memory-safety and ReDoS advisories, and parsing untrusted files is
 * exactly where that matters. The file is stored, listed and downloadable as always; its
 * report says so plainly.
 */
export async function readSpreadsheet(
  bytes: Uint8Array,
  mime: SpreadsheetMime,
  limits: ReadLimits,
): Promise<ParsedSheet> {
  switch (mime) {
    case CSV_MIME:
      return readCsv(bytes, limits);
    case XLSX_MIME:
      return readXlsx(bytes, limits);
    case XLS_MIME:
      throw new UnsupportedFormatError(
        'Legacy .xls files cannot be profiled. Save the file as .xlsx or .csv and upload it again.',
      );
  }
}

// ---- CSV ------------------------------------------------------------------------

const DELIMITERS = [',', ';', '\t', '|'] as const;

/** The delimiter used most often on the first line — outside quotes — defaulting to a comma. */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  let best: string = ',';
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    let inQuotes = false;
    let count = 0;
    for (const char of firstLine) {
      if (char === '"') inQuotes = !inQuotes;
      else if (char === delimiter && !inQuotes) count += 1;
    }
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

function readCsv(bytes: Uint8Array, limits: ReadLimits): ParsedSheet {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new UnreadableFileError('The file is not valid UTF-8 text.');
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let records: unknown;
  try {
    records = parse(text, {
      delimiter: detectDelimiter(text),
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      // The header, every row we will read, and ONE more to learn whether there were more.
      to: limits.maxRows + 2,
    });
  } catch (error) {
    throw new UnreadableFileError(
      `The file could not be parsed as CSV: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  const table = z.array(z.array(z.string())).parse(records);
  const [header, ...rest] = table;
  if (!header) throw new UnreadableFileError('The file has no rows.');

  const truncated = rest.length > limits.maxRows;
  return {
    header: header.slice(0, limits.maxColumns),
    rows: rest.slice(0, limits.maxRows).map((row) => row.slice(0, limits.maxColumns)),
    truncated,
    columnCount: header.length,
  };
}

// ---- XLSX -----------------------------------------------------------------------

const richText = z.object({ richText: z.array(z.object({ text: z.string() }).loose()) }).loose();
const hyperlinkText = z.object({ text: z.union([z.string(), richText]) }).loose();
const formulaResult = z.object({ result: z.unknown() }).loose();
const errorCell = z.object({ error: z.string() }).loose();

/**
 * One cell from the workbook loader, which hands back strings, numbers, booleans and
 * Dates — and, for anything richer, objects. Each object shape is a Zod schema, so an
 * unexpected one degrades to `null` instead of leaking through as `[object Object]`.
 */
export function normaliseExcelCell(value: unknown, depth = 0): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (depth > 3) return null;

  const rich = richText.safeParse(value);
  if (rich.success) return rich.data.richText.map((part) => part.text).join('');

  const link = hyperlinkText.safeParse(value);
  if (link.success) {
    return typeof link.data.text === 'string'
      ? link.data.text
      : link.data.text.richText.map((part) => part.text).join('');
  }

  const formula = formulaResult.safeParse(value);
  if (formula.success) return normaliseExcelCell(formula.data.result, depth + 1);

  // A cell holding `#N/A`, `#DIV/0!`… is a data problem: keep the text so a numeric
  // column shows up as inconsistent instead of the error vanishing.
  const failure = errorCell.safeParse(value);
  if (failure.success) return failure.data.error;

  return null;
}

async function readXlsx(bytes: Uint8Array, limits: ReadLimits): Promise<ParsedSheet> {
  const summary = summariseZip(bytes);
  if (!summary) throw new UnreadableFileError('The file is not a readable .xlsx archive.');
  if (summary.uncompressedBytes > MAX_UNCOMPRESSED_XLSX_BYTES) {
    throw new UnreadableFileError(
      'The spreadsheet expands to more data than can be profiled safely. Split it, or export it as CSV.',
    );
  }

  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs types its input as its own `Buffer` (an ArrayBuffer shape); a copy is one.
    await workbook.xlsx.load(new Uint8Array(bytes).buffer);
  } catch (error) {
    throw new UnreadableFileError(
      `The file could not be read as .xlsx: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  const sheet = workbook.worksheets.find((candidate) => candidate.actualRowCount > 0);
  if (!sheet) throw new UnreadableFileError('The workbook has no rows.');

  const width = Math.min(sheet.columnCount, limits.maxColumns);
  const lastRow = Math.min(sheet.rowCount, limits.maxRows + 2);
  const table: CellValue[][] = [];
  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const cells: CellValue[] = [];
    for (let column = 1; column <= width; column += 1) {
      cells.push(normaliseExcelCell(row.getCell(column).value));
    }
    table.push(cells);
  }

  const [header, ...rest] = table;
  if (!header) throw new UnreadableFileError('The workbook has no rows.');
  return {
    header,
    rows: rest.slice(0, limits.maxRows),
    truncated: sheet.rowCount > limits.maxRows + 1,
    columnCount: sheet.columnCount,
  };
}
