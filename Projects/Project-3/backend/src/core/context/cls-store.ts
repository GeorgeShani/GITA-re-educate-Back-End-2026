import type { ClsStore } from 'nestjs-cls';

/**
 * Typed request context.
 *
 * Project-2 stored a single key as a magic string in ~25 files with no type
 * augmentation. Doing this on day one means `cls.get('corelationId')` is a
 * compile error rather than a silent `undefined`.
 *
 * `companyId`/`userId`/`role` are declared now but only populated once the auth
 * guard lands in Milestone 3 — they are what makes every tenant-scoped query
 * and every Observe span filterable by tenant.
 */
declare module 'nestjs-cls' {
  interface ClsStore {
    /** Echoes an inbound `x-correlation-id`, else a fresh UUID. */
    correlationId: string;
    /** Populated by the auth guard (Milestone 3). */
    userId?: string;
    /** Populated by the auth guard (Milestone 3). The tenant boundary. */
    companyId?: string;
    role?: 'admin' | 'employee';
    /** Set when the request was made with an API key; the audit log records it. */
    apiKeyId?: string;
    /** The inbound request's IP, for `AuditLogEntry.ip`. Absent outside HTTP. */
    ip?: string;
  }
}

export type GridlineClsStore = ClsStore;
