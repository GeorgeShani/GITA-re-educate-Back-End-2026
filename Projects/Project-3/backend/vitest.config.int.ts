import { defineConfig } from 'vitest/config';

/**
 * Integration tests — these hit a real Postgres.
 *
 * `fileParallelism: false` because the suites share one database and truncate
 * between tests; running files concurrently would have them wiping each other's
 * rows. Phase 2 adds the actual harness.
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.integration.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['./test/setup.ts', './test/setup-env.ts'],
    fileParallelism: false,
    // First run may create a schema and pull a container image.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
