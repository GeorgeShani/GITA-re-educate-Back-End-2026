import dataSource from './data-source.js';

/**
 * `npm run migration:run` → `node dist/database/migrate.js`.
 *
 * Deliberately NOT run through a TS loader: `tsx`/esbuild drop
 * `emitDecoratorMetadata`, so `@Column()` throws "column type not defined";
 * Node's own type-stripping doesn't transform decorators at all. This imports
 * the ALREADY-COMPILED `data-source.js`, so `nest build` must run first —
 * `docker-compose.yml`'s `migrate` service builds the `build` stage, which
 * already has `dist/`, so this works there unchanged.
 */
async function main(): Promise<void> {
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}

await main();
