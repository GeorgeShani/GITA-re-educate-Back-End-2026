import { describe, expect, it } from 'vitest';
import { decodeMultipartName, sanitizeFileName } from './files.service.js';

/** What multer hands over for a UTF-8 `filename` it read as Latin-1. */
const asMulterSeesIt = (name: string) => Buffer.from(name, 'utf8').toString('latin1');

describe('decodeMultipartName', () => {
  it.each(['ანგარიში 2026.csv', 'café.csv', '日本語.xlsx', 'plain.csv'])('recovers %s', (name) => {
    expect(decodeMultipartName(asMulterSeesIt(name))).toBe(name);
  });

  it('leaves a name that really was Latin-1 exactly as received', () => {
    // 0xE9 alone is not valid UTF-8, so there is nothing to repair.
    const latin1 = Buffer.from([0x63, 0x61, 0x66, 0xe9]).toString('latin1');
    expect(decodeMultipartName(latin1)).toBe(latin1);
  });
});

describe('sanitizeFileName', () => {
  it.each([
    ['..\\..\\etc\\evil.csv', 'evil.csv'],
    ['../../etc/passwd.csv', 'passwd.csv'],
    ['C:\\Users\\me\\report.csv', 'report.csv'],
    ['  padded.csv  ', 'padded.csv'],
    ['line\nbreak\u0000.csv', 'linebreak.csv'],
  ])('%j → %j', (raw, expected) => {
    expect(sanitizeFileName(raw)).toBe(expected);
  });

  it('never returns an empty name', () => {
    expect(sanitizeFileName('')).toBe('upload');
    expect(sanitizeFileName('/')).toBe('upload');
    expect(sanitizeFileName('\u0000\u0001')).toBe('upload');
  });

  it('bounds the length', () => {
    expect(sanitizeFileName(`${'a'.repeat(400)}.csv`)).toHaveLength(255);
  });
});
