import { z } from 'zod';

export const SUBSCRIBABLE_WEBHOOK_EVENTS = [
  'report.ready',
  'report.failed',
  'rules.failed',
  'quota.threshold',
  'invoice.finalized',
  'file.uploaded',
] as const;
export type SubscribableWebhookEvent =
  (typeof SUBSCRIBABLE_WEBHOOK_EVENTS)[number];

export const OUTGOING_WEBHOOK_EVENTS = [
  ...SUBSCRIBABLE_WEBHOOK_EVENTS,
  'ping',
] as const;
export type OutgoingWebhookEvent = (typeof OUTGOING_WEBHOOK_EVENTS)[number];

export const webhookEnvelopeSchema = z.object({
  id: z.uuid(),
  type: z.enum(OUTGOING_WEBHOOK_EVENTS),
  createdAt: z.iso.datetime(),
  companyId: z.uuid(),
  schemaVersion: z.literal(1),
  data: z.record(z.string(), z.unknown()),
});
export type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>;
