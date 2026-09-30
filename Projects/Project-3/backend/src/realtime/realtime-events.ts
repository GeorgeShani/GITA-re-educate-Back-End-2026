import type { ReportStatus } from '#/files/data-quality-report.entity.js';
import type { NotificationType } from '#/notifications/notification-content.js';
import type { Plan } from '#/subscriptions/plan-catalog.js';

/** Socket.IO rooms. A socket joins these on connect; emits address rooms, never sockets. */
export const companyRoom = (companyId: string) => `company:${companyId}`;
export const userRoom = (userId: string) => `user:${userId}`;
/** Only admins of that company. */
export const adminRoom = (companyId: string) => `admins:${companyId}`;
export const fileRoom = (fileId: string) => `file:${fileId}`;

/** A file's report moved to a new status. `error` is set when it is `failed` or `unsupported`. */
export interface FileStatusEvent {
  fileId: string;
  status: ReportStatus;
  error: string | null;
  /** How the file did against the company's quality rules; null until `ready`, or when none applied. */
  qualityScore: number | null;
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

export interface SessionExpiringEvent {
  expiresAt: string;
}

export interface SessionExpiredEvent {
  expiredAt: string;
}

export interface AuthRefreshRequest {
  token: string;
}

export type AuthRefreshResult =
  { ok: true; expiresAt: string } | { ok: false; error: 'unauthorized' };

export type AuthRefreshAcknowledgement = (result: AuthRefreshResult) => void;

export interface CommentRealtimeEvent {
  id: string;
  fileId: string;
  parentId: string | null;
  body: string | null;
  author: { id: string; fullName: string };
  mentionedUsers: Array<{ id: string; fullName: string }>;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface CommentTypingEvent {
  fileId: string;
  userId: string;
  isTyping: boolean;
}

export interface PresenceChangedEvent {
  fileId: string;
  userIds: string[];
}

export type SocketActionResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'rate_limited' | 'too_many_files' };
export type SocketActionAcknowledgement = (result: SocketActionResult) => void;

/** What the server pushes. The client sends nothing but its handshake. */
export interface ServerToClientEvents {
  'file.status': (event: FileStatusEvent) => void;
  'quota.updated': (event: QuotaUpdatedEvent) => void;
  'audit.appended': (event: AuditAppendedEvent) => void;
  'notification.created': (event: NotificationCreatedEvent) => void;
  'session.expiring': (event: SessionExpiringEvent) => void;
  'session.expired': (event: SessionExpiredEvent) => void;
  'comment.created': (event: CommentRealtimeEvent) => void;
  'comment.updated': (event: CommentRealtimeEvent) => void;
  'comment.deleted': (event: CommentRealtimeEvent) => void;
  'comment.typing': (event: CommentTypingEvent) => void;
  'presence.changed': (event: PresenceChangedEvent) => void;
}

export interface ClientToServerEvents {
  'auth.refresh': (
    request: AuthRefreshRequest,
    acknowledge: AuthRefreshAcknowledgement,
  ) => void;
  'file.watch': (
    request: { fileId: string },
    acknowledge: SocketActionAcknowledgement,
  ) => void;
  'file.unwatch': (
    request: { fileId: string },
    acknowledge: SocketActionAcknowledgement,
  ) => void;
  'comment.typing': (request: { fileId: string; isTyping: boolean }) => void;
}
export type InterServerEvents = Record<string, never>;

/** Filled by the handshake middleware; read when the socket joins its rooms. */
export interface SocketData {
  userId: string;
  companyId: string;
  role: 'admin' | 'employee';
  expiresAt: number;
  expirationWarningSent: boolean;
}
