import type { SeedAccess, SeedFormat } from './shared.js';
import type { Table } from './table.js';

/** Who does something: the company's admin, or an employee by position in its roster (0 is the first). */
export type Actor = 'admin' | number;

/** A file the seed uploads as a first version of a new dataset. */
export interface SeedFile {
  /** Stable name for this file inside the plan, so a version, a comment or a question can point at it. */
  key: string;
  /** What it is called when uploaded, extension included. */
  name: string;
  format: SeedFormat;
  table: Table;
  uploader: Actor;
  access?: SeedAccess;
}

/** The next version of an earlier file: it inherits its access, so only who uploads it is chosen. */
export interface SeedVersion {
  of: string;
  name: string;
  format: SeedFormat;
  table: Table;
  uploader: Actor;
}

export interface SeedRule {
  name: string;
  kind: 'required_column' | 'max_null_percent' | 'type_is' | 'min_value' | 'max_value' | 'unique' | 'max_duplicate_rows' | 'no_sensitive_data';
  columnName?: string;
  params?: Record<string, unknown>;
  severity: 'error' | 'warning';
}

export interface SeedComment {
  file: string;
  author: Actor;
  body: string;
  /** Employees (by roster position) to @mention. Only people who can already see the file are ever mentioned. */
  mentions?: readonly number[];
  /** The position, within this company's comments, of the comment this answers. */
  replyTo?: number;
}

/** What one company gets once it exists: its files, versions, rules, a cleaning, conversation and questions. */
export interface CompanyContent {
  files: SeedFile[];
  versions: SeedVersion[];
  /** The columns that identify a row, by file key: saved so each new version is compared row by row. */
  keyColumns: Record<string, string[]>;
  rules: SeedRule[];
  /** A file to clean into its next version, and the steps. */
  clean?: { file: string; recipe: { steps: Array<Record<string, unknown>> } };
  comments: SeedComment[];
  /** Questions put to a file in words (only when the AI is on), and queries built by hand. */
  asks: Array<{ file: string; question: string }>;
  explores: Array<{ file: string; query: Record<string, unknown> }>;
}
