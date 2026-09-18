/**
 * Loads `.env` into `process.env` before anything else runs.
 *
 * MUST be the first import in any entrypoint that reads config at
 * module-evaluation time — `AppModule`'s conditional Observe registration
 * calls `loadConfig()` synchronously while its `@Module` decorator is being
 * evaluated, which happens the moment `app.module.js` is imported, before any
 * of that importing file's own top-level statements run. ES module imports
 * are evaluated in the order first encountered and each runs to completion
 * before the next begins, so this only works if it is genuinely the first
 * import — see `main.ts` and `data-source.ts`.
 *
 * Docker never needs this: `docker-compose.yml` injects real container env
 * vars via `env_file`, so there is no `.env` file there at all, and that must
 * not be a fatal error — hence the try/catch, and no `dotenv` dependency.
 */
try {
  process.loadEnvFile('.env');
} catch {
  // No .env present — expected in Docker and in CI.
}
