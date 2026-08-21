// SCOPE.md B2 Consumers table. Every queue is declared here even before
// its consumer exists (BullMQ queues accumulate jobs safely with no
// worker attached) — but per the storefront backend plan, the outbox's
// routing table (event-routing.ts) only routes to a queue once that
// queue's consumer actually ships, so nothing silently backs up waiting
// for a future slice.
export enum QueueName {
  NOTIFICATIONS = 'notifications',
  MEDIA = 'media',
  SEARCH = 'search',
  ANALYTICS = 'analytics',
  AUDIT_LOG = 'audit-log',
  WEBHOOKS = 'webhooks',
}
