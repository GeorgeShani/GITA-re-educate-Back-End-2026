import { QueueName } from '../queues/queue-names.enum';

export interface EventRoute {
  /** Exact event name ("media.uploaded") or a trailing-glob prefix ("order.*"). */
  pattern: string;
  queue: QueueName;
}

// The outbox relay's routing table — which queues an event fans out to.
// SCOPE.md B2 documents the full mapping (notifications/media/search/
// analytics/audit-log/webhooks), but this list only contains entries for
// queues that currently have a real consumer. Each feature slice adds
// its own pattern here in the same commit that ships its consumer —
// see queue-names.enum.ts for why routing ahead of a consumer existing
// is deliberately avoided.
//
// audit-log is the exception: it's genuinely wildcard (subscribes to
// every event) and ships in S2 alongside this table, so '*' is here from
// the start.
export const EVENT_ROUTES: EventRoute[] = [
  { pattern: '*', queue: QueueName.AUDIT_LOG },
];

export function resolveQueuesForEvent(eventName: string): QueueName[] {
  const queues = new Set<QueueName>();

  for (const route of EVENT_ROUTES) {
    if (matchesPattern(eventName, route.pattern)) {
      queues.add(route.queue);
    }
  }

  return [...queues];
}

function matchesPattern(eventName: string, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === eventName) return true;
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -1); // "order.*" -> "order."
    return eventName.startsWith(prefix);
  }
  return false;
}
