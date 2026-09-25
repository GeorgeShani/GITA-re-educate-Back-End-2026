import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, isAuditAction } from './audit-actions.js';

/** Every non-spec source file under `src/`. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Actions the code EMITS: an `action: 'x.y'` literal passed to `audit.record`. */
function emittedActions(): Set<string> {
  const found = new Set<string>();
  for (const file of sourceFiles(join(process.cwd(), 'src'))) {
    if (file.endsWith('audit-actions.ts')) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(/\baction:\s*'([a-z_]+\.[a-z_]+)'/g)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return found;
}

describe('the audit-action registry', () => {
  it('has no duplicates and follows `<area>.<what_happened>`', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
    for (const action of AUDIT_ACTIONS) expect(action).toMatch(/^[a-z]+(?:_[a-z]+)*\.[a-z]+(?:_[a-z]+)*$/);
  });

  it('lists exactly the actions the code emits — no dead entries, no unlisted actions', () => {
    const emitted = emittedActions();
    const registered = new Set<string>(AUDIT_ACTIONS);

    expect([...emitted].filter((action) => !registered.has(action)), 'emitted but not registered').toEqual([]);
    expect([...registered].filter((action) => !emitted.has(action)), 'registered but never emitted').toEqual([]);
  });

  it('isAuditAction narrows a string to the registry', () => {
    expect(isAuditAction('file.uploaded')).toBe(true);
    expect(isAuditAction('file.exploded')).toBe(false);
  });
});
