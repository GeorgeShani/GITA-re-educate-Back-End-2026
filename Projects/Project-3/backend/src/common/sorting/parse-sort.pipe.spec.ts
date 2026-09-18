import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ParseSortPipe } from './parse-sort.pipe.js';

describe('ParseSortPipe', () => {
  const pipe = new ParseSortPipe(['createdAt', 'fileName']);

  it('returns an empty array for an absent value', () => {
    expect(pipe.transform(undefined)).toEqual([]);
    expect(pipe.transform('')).toEqual([]);
  });

  it('parses a single ascending field', () => {
    expect(pipe.transform('createdAt')).toEqual([
      { field: 'createdAt', direction: 'ASC' },
    ]);
  });

  it('parses a leading "-" as descending', () => {
    expect(pipe.transform('-createdAt')).toEqual([
      { field: 'createdAt', direction: 'DESC' },
    ]);
  });

  it('parses multiple comma-separated fields, trimming whitespace', () => {
    expect(pipe.transform('-createdAt, fileName')).toEqual([
      { field: 'createdAt', direction: 'DESC' },
      { field: 'fileName', direction: 'ASC' },
    ]);
  });

  it('rejects a field outside the whitelist, naming it', () => {
    expect(() => pipe.transform('secret')).toThrowError(BadRequestException);
    expect(() => pipe.transform('secret')).toThrowError(/secret/);
  });

  it('rejects one bad field even when others in the list are valid', () => {
    expect(() => pipe.transform('createdAt,secret')).toThrowError(BadRequestException);
  });

  it('never allows a field wider than the whitelist it was built with', () => {
    const narrow = new ParseSortPipe(['id']);
    expect(() => narrow.transform('createdAt')).toThrowError(BadRequestException);
  });
});
