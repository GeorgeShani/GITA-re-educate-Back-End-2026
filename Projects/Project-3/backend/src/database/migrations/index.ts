import type { MixedList } from 'typeorm';
import { InitialSchema1789722852579 } from './1789722852579-InitialSchema.js';
import { PlatformServices1790182668122 } from './1790182668122-PlatformServices.js';
import { AuthCore1790189091689 } from './1790189091689-AuthCore.js';
import { BillingCore1790240568294 } from './1790240568294-BillingCore.js';
import { OAuthIdentities1790262864492 } from './1790262864492-OAuthIdentities.js';
import { FilesAndIdempotency1790265133409 } from './1790265133409-FilesAndIdempotency.js';
import { DataQualityReports1790284381430 } from './1790284381430-DataQualityReports.js';
import { ApiKeys1790315301576 } from './1790315301576-ApiKeys.js';
import { DemoCompany1790318572253 } from './1790318572253-DemoCompany.js';
import { Notifications1790345728059 } from './1790345728059-Notifications.js';

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
export const MIGRATIONS: MixedList<Function> = [
  InitialSchema1789722852579,
  PlatformServices1790182668122,
  AuthCore1790189091689,
  BillingCore1790240568294,
  OAuthIdentities1790262864492,
  FilesAndIdempotency1790265133409,
  DataQualityReports1790284381430,
  ApiKeys1790315301576,
  DemoCompany1790318572253,
  Notifications1790345728059,
];
