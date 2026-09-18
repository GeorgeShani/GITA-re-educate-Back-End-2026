import type { MixedList } from 'typeorm';
import { InitialSchema1789722852579 } from './1789722852579-InitialSchema.js';

/**
 * Explicit array of migration classes, in run order. Migrations don't get an
 * `autoLoadEntities`-style discovery mechanism at all — the standalone CLI has
 * no Nest container to discover anything via — so this is the single source
 * of truth for both `migration:generate|revert|show` (against the compiled
 * DataSource) and the compiled `migration:run` runner.
 *
 * `migration:generate` emits a new file under this directory; add its class
 * here by hand as part of the same change.
 */
export const MIGRATIONS: MixedList<Function> = [InitialSchema1789722852579];
