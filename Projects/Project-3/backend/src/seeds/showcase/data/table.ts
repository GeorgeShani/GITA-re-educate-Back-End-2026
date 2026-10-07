import type { Random } from './random.js';

/** One sheet of data: a header and rows of text cells. Enough to write a CSV, or hand to the workbook writer. */
export interface Table {
  header: string[];
  rows: string[][];
}

function csvCell(cell: string): string {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function toCsv(table: Table): string {
  return `${[table.header, ...table.rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

/**
 * The flaws a real export has, planted at a fixed rate so reports, rules and the Clean builder have something to find:
 * blank cells, a placeholder where a value should be, stray spaces, and the odd row repeated. They are applied to the cells of
 * the named columns only, never the column that identifies a row.
 */
export interface Flaws {
  /** Columns that may be blanked, and how often (0 to 1). */
  blank?: { columns: readonly string[]; rate: number };
  /** Columns that may say `N/A` instead of a value. */
  placeholder?: { columns: readonly string[]; rate: number; text?: string };
  /** Columns whose text may carry leading or trailing spaces. */
  spaces?: { columns: readonly string[]; rate: number };
  /** The share of rows that is repeated once, right after itself. */
  duplicateRows?: number;
}

export function withFlaws(table: Table, flaws: Flaws, random: Random): Table {
  const index = (name: string): number => {
    const found = table.header.indexOf(name);
    if (found === -1) throw new Error(`No column "${name}" to plant a flaw in`);
    return found;
  };
  const rows: string[][] = [];
  for (const source of table.rows) {
    const row = [...source];
    for (const name of flaws.blank?.columns ?? []) {
      if (random.chance(flaws.blank?.rate ?? 0)) row[index(name)] = '';
    }
    for (const name of flaws.placeholder?.columns ?? []) {
      if (random.chance(flaws.placeholder?.rate ?? 0)) row[index(name)] = flaws.placeholder?.text ?? 'N/A';
    }
    for (const name of flaws.spaces?.columns ?? []) {
      const cell = row[index(name)];
      if (cell && random.chance(flaws.spaces?.rate ?? 0)) row[index(name)] = random.chance(0.5) ? ` ${cell}` : `${cell}  `;
    }
    rows.push(row);
    if (random.chance(flaws.duplicateRows ?? 0)) rows.push([...row]);
  }
  return { header: table.header, rows };
}
