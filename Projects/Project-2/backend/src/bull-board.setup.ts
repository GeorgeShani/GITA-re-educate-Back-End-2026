import { timingSafeEqual } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import type { NextFunction, Request, Response } from 'express';

import { QueueName } from './core/queues/queue-names.enum';

// Every queue with a real consumer today (core.module.ts's own
// BullModule.registerQueue list) — SEARCH/ANALYTICS/WEBHOOKS are
// declared in QueueName but have no consumer yet (event-routing.ts's own
// comment: a queue only gets routed to once its consumer ships), so
// there's nothing in Redis to show for them.
const MONITORED_QUEUES = [
  QueueName.AUDIT_LOG,
  QueueName.NOTIFICATIONS,
  QueueName.MEDIA,
  QueueName.INVOICES,
];

const BULL_BOARD_PATH = '/admin/queues';

// SCOPE.md Phase 9 — "Bull Board mounted at /admin/queues" — and
// SCOPE.md Part D's "DLQ + replay": BullMQ already retains failed jobs
// for a week after exhausting retries (OutboxPublisher's
// removeOnFail: { age: 7 days }) — that retained failed-job list IS the
// dead-letter queue; Bull Board is how it gets inspected and a failed
// job's own "retry" action (built into its UI) is the replay mechanism.
// No separate DLQ system needed.
//
// Mounted with plain Express middleware, not a NestJS controller — Bull
// Board ships its own pre-built UI/router (@bull-board/express), so
// there's no Nest route tree to gate with JwtAuthGuard/RolesGuard the
// way every other admin surface (A0-A5) is gated. HTTP Basic Auth is the
// standard, widely-precedented way to protect it instead; unset
// BULL_BOARD_USERNAME/PASSWORD and this simply never mounts, rather than
// exposing an unprotected queues UI.
export function setupBullBoard(
  app: INestApplication,
  configService: ConfigService,
): void {
  const username = configService.get<string>('BULL_BOARD_USERNAME');
  const password = configService.get<string>('BULL_BOARD_PASSWORD');
  if (!username || !password) {
    return;
  }

  const redisUrl = configService.getOrThrow<string>('REDIS_URL');
  const queues = MONITORED_QUEUES.map(
    (name) =>
      new Queue(name, {
        connection: { url: redisUrl, maxRetriesPerRequest: null },
      }),
  );

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_PATH);
  createBullBoard({
    queues: queues.map((queue) => new BullMQAdapter(queue)),
    serverAdapter,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(
    BULL_BOARD_PATH,
    basicAuth(username, password),
    serverAdapter.getRouter(),
  );
}

function basicAuth(username: string, password: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Basic ')) {
      const [user, pass] = Buffer.from(header.slice(6), 'base64')
        .toString('utf8')
        .split(':');
      if (
        user &&
        pass &&
        safeEqual(user, username) &&
        safeEqual(pass, password)
      ) {
        next();
        return;
      }
    }
    res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
    res.status(401).send('Authentication required');
  };
}

/** Constant-time comparison — a plain === leaks timing info about how many leading characters matched. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
