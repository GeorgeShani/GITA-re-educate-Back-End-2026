import type { OpenAPIObject } from '@nestjs/swagger';
import { describe, expect, it } from 'vitest';
import { API_SECTIONS, organise } from './api-structure.js';

const operation = (tag: string) => ({ tags: [tag], responses: {} });
const document = (tags: string[]): OpenAPIObject => ({
  openapi: '3.0.0',
  info: { title: 't', version: '1' },
  paths: Object.fromEntries(tags.map((tag, index) => [`/${tag}/${index}`, { get: operation(tag) }])),
});

describe('organise', () => {
  it('puts the main functionality first, whatever order the controllers registered in', () => {
    const result = organise(document(['webhooks', 'outgoing-webhooks', 'auth', 'files', 'quality-rules', 'health']));
    expect(Object.keys(result.paths)[0]).toBe('/files/3');
    expect(result.tags?.map((tag) => tag.name)).toEqual(['files', 'quality-rules', 'auth', 'outgoing-webhooks', 'webhooks', 'health']);
  });

  it('keeps the order of paths inside one tag', () => {
    const result = organise(document(['files', 'files', 'auth', 'files']));
    expect(Object.keys(result.paths)).toEqual(['/files/0', '/files/1', '/files/3', '/auth/2']);
  });

  it('describes every tag and groups them into sections, leaving out the ones the API does not use', () => {
    const result = organise(document(['auth', 'files']));
    expect(result.tags?.every((tag) => (tag.description ?? '').length > 20)).toBe(true);
    expect(Reflect.get(result, 'x-tagGroups')).toEqual([
      { name: 'Your data', tags: ['files'] },
      { name: 'Accounts and people', tags: ['auth'] },
    ]);
  });

  it('refuses a tag nobody has placed, so a new controller is put somewhere on purpose', () => {
    expect(() => organise(document(['files', 'brand-new']))).toThrow(/"brand-new" are not placed/);
  });

  it('lists each tag once', () => {
    const names = API_SECTIONS.flatMap((section) => section.tags.map((tag) => tag.name));
    expect(new Set(names).size).toBe(names.length);
  });
});
