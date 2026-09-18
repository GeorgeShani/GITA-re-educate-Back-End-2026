/**
 * MUST be the first import in any docs-tooling entrypoint (`generate.ts`,
 * `check.ts`) — before `AppModule` is imported. `AppModule`'s conditional
 * Observe registration and `DatabaseModule`'s `TypeOrmModule.forRootAsync`
 * both read `process.env` while their `@Module()` decorators evaluate, which
 * happens the instant `app.module.js` is first imported — see `load-env.ts`
 * for the same constraint applied to `.env` loading.
 *
 * Rendering API documentation should never require a live database.
 * `DatabaseModule`'s `dataSourceFactory` checks this exact flag and returns
 * an un-initialized `DataSource` instead of calling `.initialize()`.
 */
process.env.DB_SKIP_CONNECT = '1';
