import 'reflect-metadata';
import '#/load-env.js'; // MUST be the first non-side-effect-free import
import { DataSource } from 'typeorm';
import { loadConfig } from '#/config/load-config.js';
import { buildDataSourceOptions } from './data-source-options.js';

/**
 * The DataSource used OUTSIDE Nest: the TypeORM CLI
 * (`migration:generate|revert|show`, invoked as
 * `-d dist/database/data-source.js`) and the compiled migration runner
 * (`migration:run`, via `migrate.ts`, which imports this file directly).
 *
 * Always `DIRECT_URL`, never `DATABASE_URL` — see `data-source-options.ts`.
 */
const config = loadConfig();

export default new DataSource(buildDataSourceOptions(config, { direct: true }));
