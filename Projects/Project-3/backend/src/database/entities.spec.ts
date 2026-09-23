import { readdirSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENTITIES } from './entities.js';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * `autoLoadEntities` is off (see `entities.ts`) precisely because the
 * standalone migration CLI has no Nest container to discover entities via —
 * `ENTITIES` is the one list both use, so it must never silently drift from
 * what's actually on disk. Scans all of `src/` (entities live beside their
 * owning module, e.g. `core/tasks/`), not just `database/entities/`. Pure unit
 * test, no database: the question is entirely about the source tree.
 */
describe('ENTITIES array', () => {
  it('includes every entity class exported from any *.entity.ts under src/', async () => {
    const files = readdirSync(srcDir, { recursive: true, encoding: 'utf8' }).filter(
      (file) =>
        file.endsWith('.entity.ts') &&
        // The abstract base class is not a table and is never registered.
        basename(file) !== 'base.entity.ts',
    );
    // Fails loudly if the scan is ever broken, rather than passing on zero files.
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const specifier = `../${file.split(sep).join('/')}`;
      const module: Record<string, unknown> = await import(/* @vite-ignore */ specifier);
      const exportedClasses = Object.values(module).filter(isConstructor);

      expect(
        exportedClasses.length,
        `${relative(srcDir, join(srcDir, file))} exports no class — expected at least one entity`,
      ).toBeGreaterThan(0);

      const isRegistered = exportedClasses.some((cls) => ENTITIES.includes(cls));
      expect(
        isRegistered,
        `${file} exports a class not present in ENTITIES — add it to entities.ts`,
      ).toBe(true);
    }
  });

  it('has no duplicate entries', () => {
    expect(new Set(ENTITIES).size).toBe(ENTITIES.length);
  });
});

function isConstructor(value: unknown): value is new () => object {
  return typeof value === 'function';
}
