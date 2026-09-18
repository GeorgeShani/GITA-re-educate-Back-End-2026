import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations/index.js';

export interface DatabaseUrls {
  DATABASE_URL: string;
  DIRECT_URL: string;
}

/**
 * One pure function, two entry points. `TypeOrmModule.forRootAsync` (in
 * `database.module.ts`) calls this with `direct: false` — Neon's *pooled*
 * endpoint, what the running app uses. The standalone CLI DataSource and the
 * compiled migration runner call it with `direct: true` — Neon's *direct*
 * endpoint, since PgBouncer's transaction pooling mode breaks DDL and
 * prepared statements.
 *
 * `sslmode`/`channel_binding` are read by the `pg` driver straight out of the
 * connection string's own query params, so no separate `ssl` option is
 * needed here — for local Postgres, which carries neither, nothing is
 * attempted.
 */
export function buildDataSourceOptions(
  urls: DatabaseUrls,
  { direct }: { direct: boolean },
): DataSourceOptions {
  return {
    type: 'postgres',
    url: direct ? urls.DIRECT_URL : urls.DATABASE_URL,
    // Every `@PrimaryGeneratedColumn('uuid')` defaults to Postgres's
    // `uuid_generate_v4()`, which needs the `uuid-ossp` extension installed.
    // `gen_random_uuid()` has been built into core Postgres since 13 — no
    // extension, nothing to enable on a fresh Neon branch or a bare
    // container.
    uuidExtension: 'pgcrypto',
    entities: ENTITIES,
    migrations: MIGRATIONS,
    // Schema changes are migrations, always. docker-compose.yml has a
    // dedicated `migrate` service that runs once before `api` starts;
    // migrationsRun: true here would race across N replicas of `api` doing
    // it independently.
    synchronize: false,
    migrationsRun: false,
    // Neon idles and reaps aggressively; a modest ceiling plus a timeout
    // keeps connections recycling instead of piling up across restarts.
    extra: { max: 10, idleTimeoutMillis: 30_000 },
  };
}
