import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENTITIES } from './entities.js';

const entitiesDir = join(dirname(fileURLToPath(import.meta.url)), 'entities');

/**
 * `autoLoadEntities` is off (see `entities.ts`) precisely because the
 * standalone migration CLI has no Nest container to discover entities via —
 * `ENTITIES` is the one list both use, so it must never silently drift from
 * what's actually on disk. This is a pure unit test (no database) because the
 * question is entirely about the source tree, not about Postgres.
 */
describe('ENTITIES array', () => {
  it('includes every entity class exported from src/database/entities/', async () => {
    const files = readdirSync(entitiesDir).filter((file) =>
      file.endsWith('.entity.ts'),
    );
    // Fails loudly if the directory is ever emptied by accident, rather than
    // passing vacuously on zero files.
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const baseName = file.replace(/\.entity\.ts$/, '');
      const module: Record<string, unknown> = await import(
        `./entities/${baseName}.entity.ts`
      );
      const exportedClasses = Object.values(module).filter(isConstructor);

      expect(
        exportedClasses.length,
        `${file} exports no class — expected at least one entity`,
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
