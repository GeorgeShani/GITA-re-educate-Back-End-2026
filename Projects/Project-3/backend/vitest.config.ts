import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `graphql` must be loaded ONCE. Vite would resolve `import 'graphql'` in our source and specs to its
// ESM build (`index.mjs`), while `@nestjs/graphql` (run by Node) gets the CommonJS build (`main`), and
// graphql refuses a schema built by one copy when handed to the other. Pointing every import at the
// CommonJS file is what Node itself does, so tests see the same single copy production has.
const graphqlCommonJs = fileURLToPath(new URL('./node_modules/graphql/index.js', import.meta.url));

/**
 * Unit tests — no database, no network. Must stay fast enough to run on save.
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
