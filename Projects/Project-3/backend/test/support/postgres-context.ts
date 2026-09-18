import { DataSource } from 'typeorm';
import { loadConfig } from '../../src/config/load-config.js';
import { buildDataSourceOptions } from '../../src/database/data-source-options.js';

/**
 * One DataSource, shared across a whole integration spec file. Connects to
 * `DIRECT_URL` — same reasoning as migrations: bypass PgBouncer entirely —
 * against whatever Postgres `.env` currently points at: the local `db`
 * container today, a throwaway Neon branch per CI run once that's wired up.
 *
 * Unlike Project-2's `MongoTestContext`, this does not start its own server —
 * there is no in-process Postgres equivalent to `mongodb-memory-server` worth
 * reaching for here, and the schema already has to exist via a real migration
 * run before these specs are useful anyway.
 *
 * `reset()` truncates every non-`migrations` table rather than tearing down
 * and recreating the schema. Deriving the table list from `pg_tables` at
 * reset time — rather than hardcoding it — means it can never go stale the
 * next time an entity is added, the same reasoning Project-2's `seed-reset.ts`
 * used for dropping the whole database instead of enumerating collections.
 */
export class PostgresTestContext {
  private constructor(public readonly dataSource: DataSource) {}

  static async start(): Promise<PostgresTestContext> {
    const config = loadConfig();
    const dataSource = new DataSource(buildDataSourceOptions(config, { direct: true }));
    await dataSource.initialize();
    return new PostgresTestContext(dataSource);
  }

  async reset(): Promise<void> {
    const tables: { tablename: string }[] = await this.dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'migrations'`,
    );
    if (tables.length === 0) return;

    const quotedNames = tables.map((table) => `"${table.tablename}"`).join(', ');
    await this.dataSource.query(`TRUNCATE ${quotedNames} RESTART IDENTITY CASCADE`);
  }

  async stop(): Promise<void> {
    await this.dataSource.destroy();
  }
}
