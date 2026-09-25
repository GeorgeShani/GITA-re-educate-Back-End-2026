import type { ReportStatus } from '#/files/data-quality-report.entity.js';
import type { NotificationType } from '#/notifications/notification-content.js';
import type { Plan } from '#/subscriptions/plan-catalog.js';

/** Socket.IO rooms. A socket joins these on connect; emits address rooms, never sockets. */
export const companyRoom = (companyId: string) => `company:${companyId}`;
export const userRoom = (userId: string) => `user:${userId}`;
/** Only admins of that company. */
export const adminRoom = (companyId: string) => `admins:${companyId}`;

/** A file's report moved to a new status. `error` is set when it is `failed` or `unsupported`. */
export interface FileStatusEvent {
  fileId: string;
  status: ReportStatus;
  error: string | null;
}

/** An upload was counted: where the company now stands against its plan's file quota. */
export interface QuotaUpdatedEvent {
  plan: Plan;
  periodKey: string;
  filesUsed: number;
  filesLimit: number;
}

/** One audit entry was written (without its `metadata`, like the list endpoint). */
export interface AuditAppendedEvent {
  id: string;
  action: string;
  actorUserId: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

/** A new inbox entry for this person (the same shape `GET /notifications` returns). */
export interface NotificationCreatedEvent {
  id: string;
  type: NotificationType;
  payload: unknown;
  readAt: null;
  createdAt: string;
}

/** What the server pushes. The client sends nothing but its handshake. */
export interface ServerToClientEvents {
  'file.status': (event: FileStatusEvent) => void;
  'quota.updated': (event: QuotaUpdatedEvent) => void;
  'audit.appended': (event: AuditAppendedEvent) => void;
  'notification.created': (event: NotificationCreatedEvent) => void;
}

export type ClientToServerEvents = Record<string, never>;
export type InterServerEvents = Record<string, never>;

/** Filled by the handshake middleware; read when the socket joins its rooms. */
export interface SocketData {
  userId: string;
  companyId: string;
  role: 'admin' | 'employee';
}
