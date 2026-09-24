import { FileValidator } from '@nestjs/common';
import { sniffSpreadsheet } from './sniff-spreadsheet.js';

function hasBuffer(value: unknown): value is { buffer: Buffer } {
  return typeof value === 'object' && value !== null && 'buffer' in value && Buffer.isBuffer(value.buffer);
}

/**
 * Plugs magic-byte checking into Nest's `ParseFilePipeBuilder`. Nest's own
 * `FileTypeValidator` detects magic bytes too, but has no answer for CSV (no magic
 * bytes exist, so it rejects every real CSV unless told to trust the client's
 * `Content-Type`, which reopens the renamed-`.exe` hole). This one decides from the
 * bytes for all three accepted formats — see `sniffSpreadsheet`.
 */
export class SpreadsheetFileValidator extends FileValidator<Record<string, never>> {
  constructor() {
    super({});
  }

  async isValid(file?: unknown): Promise<boolean> {
    if (!hasBuffer(file)) return false;
    return (await sniffSpreadsheet(file.buffer)) !== null;
  }

  buildErrorMessage(): string {
    return 'Only CSV, XLS and XLSX spreadsheets are accepted. The file content does not match any of them, whatever its name or Content-Type says.';
  }
}
