import { Injectable } from '@nestjs/common';
import type { ParsedSheet } from '../parsing/spreadsheet-reader.js';

/** The most cells (rows × columns) kept across every cached sheet in this process. Roughly 100 MB of cells. */
const MAX_CELLS = 5_000_000;
const MAX_ENTRIES = 8;

interface Entry {
  sheet: ParsedSheet;
  cells: number;
}

/**
 * Parsed sheets kept for a short while, so a person adjusting a query does not make the server read and parse the same file at
 * every change. Per process and in memory only: a restart empties it, and another instance starts its own. Keyed by file id AND
 * the worksheet, because a file's bytes never change but the sheet asked of a workbook can. Least recently used goes first, and
 * the total is capped by the number of cells, not the number of files.
 */
@Injectable()
export class SheetCache {
  private readonly entries = new Map<string, Entry>();
  private cells = 0;

  private static keyOf(fileId: string, sheet: string | undefined): string {
    return `${fileId}\u0000${sheet ?? ''}`;
  }

  get(fileId: string, sheet: string | undefined): ParsedSheet | null {
    const key = SheetCache.keyOf(fileId, sheet);
    const entry = this.entries.get(key);
    if (!entry) return null;
    // Re-inserting makes it the most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.sheet;
  }

  set(fileId: string, sheet: string | undefined, parsed: ParsedSheet): void {
    const cells = Math.max(1, parsed.rows.length * Math.max(1, parsed.header.length));
    if (cells > MAX_CELLS) return;
    const key = SheetCache.keyOf(fileId, sheet);
    const old = this.entries.get(key);
    if (old) this.cells -= old.cells;
    this.entries.delete(key);
    this.entries.set(key, { sheet: parsed, cells });
    this.cells += cells;
    for (const [oldest, entry] of this.entries) {
      if (this.cells <= MAX_CELLS && this.entries.size <= MAX_ENTRIES) break;
      if (oldest === key) continue;
      this.entries.delete(oldest);
      this.cells -= entry.cells;
    }
  }

  clear(): void {
    this.entries.clear();
    this.cells = 0;
  }
}
