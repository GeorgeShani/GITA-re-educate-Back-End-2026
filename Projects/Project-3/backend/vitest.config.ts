import { defineConfig } from 'vitest/config';

/**
 * Unit tests — no database, no network. Must stay fast enough to run on save.
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Without this, `**/*.spec.ts` also matches `*.integration.spec.ts` and
    // `npm test` silently starts requiring a live database.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.spec.ts'],
    // TypeORM entities and class-validator DTOs both read decorator metadata at
    // import time. Nest's own entrypoints import reflect-metadata for us; a
    // spec importing an entity directly does not.
    setupFiles: ['./test/setup.ts'],
  },
});
