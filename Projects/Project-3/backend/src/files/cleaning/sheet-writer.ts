import ExcelJS from 'exceljs';
import { CSV_MIME, type SpreadsheetMime, XLSX_MIME } from '../spreadsheet-types.js';
import type { CellValue } from '../quality/metrics.js';

/** A date as it is written in a CSV: the day, or the instant when there is a time of day. */
function csvDate(date: Date): string {
  const text = date.toISOString();
  return text.endsWith('T00:00:00.000Z') ? text.slice(0, 10) : text;
}

function csvCell(cell: CellValue | undefined): string {
  if (cell === null || cell === undefined) return '';
  const text = cell instanceof Date ? csvDate(cell) : String(cell);
  // Quoted when it has to be: a comma, a quote, a line break, or spaces at either end that a reader would otherwise trim.
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** RFC 4180 text: comma-separated, `\r\n` between rows. UTF-8 without a byte-order mark, like the files most tools write. */
export function writeCsv(header: readonly string[], rows: readonly (readonly CellValue[])[]): Buffer {
  const lines = [header.map((name) => csvCell(name)).join(','), ...rows.map((row) => header.map((_, index) => csvCell(row[index])).join(','))];
  return Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8');
}

/** One worksheet, with real numbers and real dates (not text that looks like them). */
export async function writeXlsx(
  header: readonly string[],
  rows: readonly (readonly CellValue[])[],
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  // Excel's own limits on a sheet's name: 31 characters, and none of : \ / ? * [ ]
  const name = sheetName.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet1';
  const sheet = workbook.addWorksheet(name);
  sheet.addRow([...header]);
  for (const row of rows) sheet.addRow(header.map((_, index) => row[index] ?? null));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** The file in the same kind it came in: a CSV stays a CSV, a workbook a workbook. A legacy `.xls` becomes an `.xlsx`. */
export async function writeSheet(
  mime: SpreadsheetMime,
  header: readonly string[],
  rows: readonly (readonly CellValue[])[],
  sheetName: string,
): Promise<{ bytes: Buffer; mime: SpreadsheetMime; extension: 'csv' | 'xlsx' }> {
  if (mime === CSV_MIME) return { bytes: writeCsv(header, rows), mime: CSV_MIME, extension: 'csv' };
  return { bytes: await writeXlsx(header, rows, sheetName), mime: XLSX_MIME, extension: 'xlsx' };
}
