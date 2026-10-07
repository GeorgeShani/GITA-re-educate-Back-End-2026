import { describe, expect, it } from 'vitest';
import { CSV_MIME, XLSX_MIME } from '#/files/spreadsheet-types.js';
import { readSpreadsheet } from '#/files/parsing/spreadsheet-reader.js';
import { PLAN_CATALOG } from '#/subscriptions/plan-catalog.js';
import { fileBytes } from '../content-stage.js';
import { SHOWCASE } from '../plan.js';
import type { CompanyContent } from './types.js';

const LIMITS = { maxRows: 100_000, maxColumns: 200 };

function everyTable(content: CompanyContent) {
  return [...content.files, ...content.versions].map((file) => ({ name: file.name, format: file.format, table: file.table }));
}

describe.each(SHOWCASE.map((company) => [company.slug, company] as const))('the %s seed data', (_slug, company) => {
  const content = company.content();

  it('is the same every time it is made', () => {
    expect(JSON.stringify(company.content())).toBe(JSON.stringify(content));
  });

  it('writes files the app accepts, with every row as wide as the header', async () => {
    for (const { name, format, table } of everyTable(content)) {
      expect(table.rows.length, name).toBeGreaterThan(20);
      for (const row of table.rows) expect(row.length, `${name}: ${row.join('|')}`).toBe(table.header.length);

      const { bytes, mime } = await fileBytes(format, table, name);
      expect(mime).toBe(format === 'csv' ? CSV_MIME : XLSX_MIME);
      const sheet = await readSpreadsheet(bytes, mime === CSV_MIME ? CSV_MIME : XLSX_MIME, LIMITS);
      expect(sheet.header.map(String), name).toEqual(table.header);
      expect(sheet.rows.length, name).toBe(table.rows.length);
    }
  });

  it('refers only to things that exist', () => {
    const keys = new Set(content.files.map((file) => file.key));
    expect(keys.size).toBe(content.files.length);
    const roster = company.employees.length;
    const person = (actor: 'admin' | number): boolean => actor === 'admin' || (actor >= 0 && actor < roster);

    for (const file of content.files) {
      expect(person(file.uploader), `${file.key} uploader`).toBe(true);
      for (const position of file.access?.grantedTo ?? []) expect(person(position), `${file.key} grant`).toBe(true);
    }
    for (const version of content.versions) {
      expect(keys.has(version.of), `version of ${version.of}`).toBe(true);
      expect(person(version.uploader)).toBe(true);
      const first = content.files.find((file) => file.key === version.of);
      expect(version.table.header, `${version.of} keeps its columns`).toEqual(first?.table.header);
    }
    for (const [key, columns] of Object.entries(content.keyColumns)) {
      const header = content.files.find((file) => file.key === key)?.table.header ?? [];
      for (const column of columns) expect(header, `key column ${column} of ${key}`).toContain(column);
    }
    for (const [index, comment] of content.comments.entries()) {
      expect(keys.has(comment.file)).toBe(true);
      expect(person(comment.author)).toBe(true);
      for (const position of comment.mentions ?? []) expect(person(position)).toBe(true);
      if (comment.replyTo !== undefined) expect(comment.replyTo).toBeLessThan(index);
    }
    for (const ask of content.asks) expect(keys.has(ask.file)).toBe(true);
    for (const explore of content.explores) expect(keys.has(explore.file)).toBe(true);
    if (content.clean) expect(keys.has(content.clean.file)).toBe(true);
  });

  it('only mentions people who can see the file, and never comments as someone who cannot', () => {
    for (const comment of content.comments) {
      const file = content.files.find((candidate) => candidate.key === comment.file);
      if (file?.access?.visibility !== 'restricted') continue;
      const allowed = new Set<'admin' | number>(['admin', file.uploader, ...(file.access.grantedTo ?? [])]);
      expect(allowed.has(comment.author), `${comment.file} author`).toBe(true);
      for (const position of comment.mentions ?? []) expect(allowed.has(position), `${comment.file} mention`).toBe(true);
    }
  });

  it('stays inside what its plan allows', () => {
    const rules = PLAN_CATALOG[company.targetPlan];
    const uploads = content.files.length + content.versions.length;
    expect(uploads).toBeLessThanOrEqual(rules.filesPerPeriod);
    if (rules.maxQualityRules !== null) expect(content.rules.length).toBeLessThanOrEqual(rules.maxQualityRules);
    const seatsAtPeak = company.employees.length + (company.invitee ? 1 : 0);
    if (rules.maxEmployees !== null) expect(seatsAtPeak).toBeLessThanOrEqual(rules.maxEmployees);
    if (rules.maxVersionsPerDataset !== null) {
      for (const file of content.files) {
        expect(1 + content.versions.filter((version) => version.of === file.key).length).toBeLessThanOrEqual(rules.maxVersionsPerDataset);
      }
    }
    expect(content.asks.length).toBeLessThanOrEqual(rules.questionsPerPeriod);
  });

  it('has a quality rule that is both a column rule and a whole-file rule, and one that names a real column', () => {
    expect(content.rules.some((rule) => rule.kind === 'no_sensitive_data')).toBe(true);
    const headers = new Set(everyTable(content).flatMap(({ table }) => table.header.map((name) => name.toLowerCase())));
    for (const rule of content.rules) {
      if (rule.columnName) expect(headers.has(rule.columnName.toLowerCase()), rule.name).toBe(true);
    }
  });

  it('plants flaws for the reports and Clean to find, and never an address that could be mailed', () => {
    const cells = content.files.flatMap((file) => file.table.rows.flat());
    expect(cells.some((cell) => cell === '')).toBe(true);
    expect(cells.some((cell) => /^n\/a$/i.test(cell))).toBe(true);
    expect(cells.some((cell) => cell.length > 0 && cell !== cell.trim())).toBe(true);

    const duplicated = content.files.some(({ table }) => {
      const seen = new Set<string>();
      return table.rows.some((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      });
    });
    expect(duplicated).toBe(true);

    for (const cell of cells) {
      for (const address of cell.match(/[^\s@,]+@[^\s@,]+/g) ?? []) expect(address, 'a real mailbox in the data').toMatch(/@example\.(com|ge)$/);
    }
  });
});

describe('the roster', () => {
  it('has the shape the brief asks for', () => {
    const [northwind, meridian, kavkasia] = SHOWCASE;
    expect(northwind).toMatchObject({ targetPlan: 'basic', industry: 'logistics', country: 'GE' });
    expect(northwind?.employees.filter((person) => !person.removed)).toHaveLength(6);
    expect(northwind?.employees.filter((person) => person.removed)).toHaveLength(1);
    expect(northwind?.invitee).toBeDefined();
    expect(meridian).toMatchObject({ targetPlan: 'premium', industry: 'healthcare', country: 'DE' });
    expect(meridian?.employees).toHaveLength(7);
    expect(kavkasia).toMatchObject({ targetPlan: 'free', industry: 'e-commerce', country: 'GE' });
    expect(kavkasia?.employees).toHaveLength(0);
  });

  it('finishes within the paid companies\' range of uploads', () => {
    for (const company of SHOWCASE.filter((candidate) => candidate.targetPlan !== 'free')) {
      const uploads = company.content().files.length;
      expect(uploads, company.slug).toBeGreaterThanOrEqual(7);
      expect(uploads, company.slug).toBeLessThanOrEqual(12);
    }
    expect(SHOWCASE[2]?.content().files.length).toBeLessThanOrEqual(6);
  });
});
