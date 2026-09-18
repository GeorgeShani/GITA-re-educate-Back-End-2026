import './load-env.js'; // MUST be the first import — see load-env.ts
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule, ObserveInstrument } from './app.module.js';
import { APP_CONFIG } from './config/load-config.js';
import type { AppConfig } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    // Hold framework logs until pino is available, then replay them through it,
    // so there is ONE log format end to end rather than Nest's plain format for
    // bootstrap and JSON for requests. Project-2 abandoned this on Nest 11 +
    // nestjs-pino 4 (it silently dropped every line); re-attempted here on
    // Nest 12 + nestjs-pino 5, and verified by the gate.
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.flushLogs();

  const config = app.get<AppConfig>(APP_CONFIG);

  app.use(helmet());

  // Only matters for local non-Docker dev, where web (:3000) calls api (:4000)
  // cross-origin. Behind Caddy everything is one origin and this is inert.
  app.enableCors({ origin: config.corsOrigins, credentials: true });

  // Deliberately NO setGlobalPrefix. Caddy's `handle_path /api/*` already strips
  // that segment before forwarding, so the app serves unprefixed routes; adding
  // a prefix here would make the public path /api/api/...
  // See SCOPE.md, "Docker — one origin, five services".

  // SIGTERM from `docker stop` must close the DataSource, or Neon leaks a
  // connection per restart and its ceiling is low enough to notice.
  app.enableShutdownHooks();

  await app.listen(config.PORT);
}

await bootstrap();
