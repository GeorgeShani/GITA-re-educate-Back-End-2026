import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `graphql` must be loaded ONCE. Vite would resolve `import 'graphql'` in our source and specs to its
// ESM build (`index.mjs`), while `@nestjs/graphql` (run by Node) gets the CommonJS build (`main`), and
// graphql refuses a schema built by one copy when handed to the other. Pointing every import at the
// CommonJS file is what Node itself does, so tests see the same single copy production has.
const graphqlCommonJs = fileURLToPath(new URL('./node_modules/graphql/index.js', import.meta.url));

/**
 * Integration tests — these hit a real Postgres.
 *
 * `fileParallelism: false` because the suites share one database and truncate
 * between tests; running files concurrently would have them wiping each other's
 * rows.
 */
export default defineConfig({
  // Resolve `#/*` and `#test/*` (package.json "imports") to source, not `dist/`.
  // Must be set for the SSR environment too: that is what Vitest runs Node code
  // in, and without it `#/*` silently falls back to its `default` (`dist/`) —
  // stale compiled code, and a second copy of every class.
  resolve: { conditions: ['gridline-source'], alias: [{ find: /^graphql$/, replacement: graphqlCommonJs }] },
  ssr: { resolve: { conditions: ['gridline-source'] } },
  test: {
    globals: true,
    root: './',
    include: ['**/*.integration.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['./test/setup.ts', './test/setup-env.ts'],
    // Forced, not read from `.env` (which says `development` for host-based dev).
    // `test` switches off the background task scheduler so specs drain the queue
    // explicitly and deterministically; `fatal` keeps a booted AppModule quiet.
    // Vitest applies these before setup files run, and `loadEnvFile` never
    // overrides a variable that is already set.
    env: { NODE_ENV: 'test', LOG_LEVEL: 'fatal', RATE_LIMIT_ENABLED: 'false' },
    fileParallelism: false,
    // First run may create a schema and pull a container image.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
