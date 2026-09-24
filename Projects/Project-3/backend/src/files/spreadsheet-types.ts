/**
 * The only three things Gridline accepts. The MIME type stored on a file is one of
 * these, decided from the file's BYTES — never from the extension or `Content-Type`
 * the client sent.
 */
export const CSV_MIME = 'text/csv';
export const XLS_MIME = 'application/vnd.ms-excel';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const SPREADSHEET_MIME_TYPES = [CSV_MIME, XLS_MIME, XLSX_MIME] as const;
export type SpreadsheetMime = (typeof SPREADSHEET_MIME_TYPES)[number];

/** The brief's limit. Enforced by multer while streaming, so an oversized upload is never buffered whole. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
