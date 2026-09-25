import { z } from 'zod';
import { PLANS } from '#/subscriptions/plan-catalog.js';

/**
 * Every kind of notification, with the shape of its payload. `type` is stored as plain text (not a
 * Postgres enum, like an audit action): later features add kinds, and an `ALTER TYPE` migration for
 * each would buy nothing. This union is the closed vocabulary — a write is validated against it, and
 * a row read back is parsed through it, because a `jsonb` column is untyped by definition.
 *
 * Payloads carry ids, counts and names — never cell values. The client renders the sentence; the
 * server only says what happened.
 */
export const notificationContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('quota.threshold'),
    payload: z.object({
      threshold: z.union([z.literal(80), z.literal(100)]),
      plan: z.enum(PLANS),
      periodKey: z.string(),
      filesUsed: z.number().int(),
      filesLimit: z.number().int(),
      /** The plan that raises the limit; null on the top plan. */
      upgradeTo: z.enum(PLANS).nullable(),
    }),
  }),
  z.object({
    type: z.literal('report.ready'),
    payload: z.object({ fileId: z.uuid(), fileName: z.string() }),
  }),
  z.object({
    type: z.literal('report.failed'),
    payload: z.object({ fileId: z.uuid(), fileName: z.string(), reason: z.string() }),
  }),
  z.object({
    type: z.literal('file.shared'),
    payload: z.object({ fileId: z.uuid(), fileName: z.string(), sharedByUserId: z.uuid() }),
  }),
  z.object({
    type: z.literal('invoice.finalized'),
    payload: z.object({
      invoiceId: z.uuid(),
      totalCents: z.number().int(),
      periodStart: z.string(),
      periodEnd: z.string(),
    }),
  }),
]);

export type NotificationContent = z.infer<typeof notificationContentSchema>;
export type NotificationType = NotificationContent['type'];

export const NOTIFICATION_TYPES = notificationContentSchema.options.map((option) => option.shape.type.value);
