import { type NotificationContent, notificationContentSchema } from './notification-content.js';
import type { Notification } from './notification.entity.js';

/** A stored notification whose payload has been parsed back through its schema. */
export type NotificationView = NotificationContent & {
  id: string;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * Reads a row back into a typed view. A row that no longer parses (a schema that moved on under
 * old data) is `null`, so one bad row can never take the whole inbox down.
 */
export function viewOf(row: Notification): NotificationView | null {
  const parsed = notificationContentSchema.safeParse({ type: row.type, payload: row.payload });
  return parsed.success ? { ...parsed.data, id: row.id, readAt: row.readAt, createdAt: row.createdAt } : null;
}
