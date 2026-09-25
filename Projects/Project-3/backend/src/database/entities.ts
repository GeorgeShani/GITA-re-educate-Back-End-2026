import { ApiKey } from '#/api-keys/api-key.entity.js';
import { Invoice } from '#/billing/invoice.entity.js';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { IdempotencyRecord } from '#/core/idempotency/idempotency-record.entity.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';
import { DataQualityReport } from '#/files/data-quality-report.entity.js';
import { FileAccessGrant } from '#/files/file-access-grant.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { SubscriptionChange } from '#/subscriptions/subscription-change.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { AuthIdentity } from './entities/auth-identity.entity.js';
import { AuthToken } from './entities/auth-token.entity.js';
import { Company } from './entities/company.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';

/**
 * The single source of truth for which entities exist — used by BOTH the
 * standalone migration CLI (which has no Nest container, so
 * `autoLoadEntities` is unavailable to it) and `TypeOrmModule`
 * (`autoLoadEntities: false`, deliberately: a second, divergent list would
 * drift as a missing table in a generated migration rather than a loud
 * error). A drift spec asserts every `*.entity.ts` file under `src/`
 * appears here.
 *
 * Typed as `(new () => object)[]` rather than left as an inferred union of the
 * five specific classes — TypeORM requires every entity to be constructible
 * with no required arguments anyway (it does `new EntityClass()` internally
 * during hydration), and the wider type is what lets the drift spec compare
 * a dynamically-imported class against this array with no assertion.
 */
export const ENTITIES: (new () => object)[] = [
  Company,
  User,
  AuthIdentity,
  AuthToken,
  RefreshToken,
  BackgroundTask,
  AuditLogEntry,
  Subscription,
  SubscriptionChange,
  Invoice,
  UsageEvent,
  SeatInterval,
  FileAsset,
  FileAccessGrant,
  IdempotencyRecord,
  DataQualityReport,
  ApiKey,
];
