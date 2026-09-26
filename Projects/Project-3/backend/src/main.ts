import './load-env.js'; // MUST be the first import — see load-env.ts
import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule, ObserveInstrument } from './app.module.js';
import { APP_CONFIG } from './config/load-config.js';
import type { AppConfig } from './config/env.schema.js';
import { CSP_NONCE_LOCALS_KEY } from './docs/csp-nonce.js';
import { mountScalarReference } from './docs/scalar.js';
import { buildOpenApiDocument } from './docs/swagger-document.js';

/**
 * Reads back the nonce `mountScalarReference`'s middleware stashes on
 * `res.locals` — declared against helmet's own `ServerResponse` parameter
 * type (not Express's `Response`) so this stays a type guard rather than a
 * cast. Express always populates `.locals` as an object, but the type
 * helmet hands the directive-value callback doesn't say so.
 */
function hasLocals(res: ServerResponse): res is ServerResponse & { locals: Record<string, unknown> } {
  return 'locals' in res;
}

function scriptSrcNonce(_req: IncomingMessage, res: ServerResponse): string {
  if (!hasLocals(res)) return "'self'";
  const nonce = res.locals[CSP_NONCE_LOCALS_KEY];
  return typeof nonce === 'string' ? `'nonce-${nonce}'` : "'self'";
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
    // Hold framework logs until pino is available, then replay them through it,
    // so there is ONE log format end to end rather than Nest's plain format for
    // bootstrap and JSON for requests. Project-2 abandoned this on Nest 11 +
    // nestjs-pino 4 (it silently dropped every line); re-attempted here on
    // Nest 12 + nestjs-pino 5, and verified by the gate.
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  app.flushLogs();

  const config = app.get<AppConfig>(APP_CONFIG);

  // The real client address (for audit `ip` and IP throttling) sits in X-Forwarded-For when a
  // proxy fronts the API. Trust exactly as many hops as there are proxies, never more: an
  // untrusted hop would let a client choose its own address.
  if (config.TRUST_PROXY > 0) app.set('trust proxy', config.TRUST_PROXY);

  // Mints one nonce per request, before helmet computes that request's CSP
  // header — `scriptSrcNonce` below reads it back into `script-src`, and
  // `mountScalarReference` reads the same value to hand Scalar's renderer.
  // Verified against a real browser: without this, Scalar's inline
  // `createApiReference(...)` bootstrap script (see
  // `@scalar/client-side-rendering`'s `getScriptTags`) is silently blocked by
  // CSP and `/reference` renders a blank page with no visible error besides
  // a console warning.
  app.use((_req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (hasLocals(res)) {
      res.locals[CSP_NONCE_LOCALS_KEY] = randomBytes(16).toString('base64');
    }
    next();
  });

  app.use(
    helmet({
      // Scalar's client-side bundle loads from jsDelivr by default; the
      // default `script-src 'self'`/`style-src 'self'` would silently block
      // it (confirmed against Phase 1's own captured CSP header) with no
      // error beyond a blank page and a console warning. `useDefaults: true`
      // (the default) keeps every other directive locked to `'self'`.
      //
      // The per-request nonce (rather than `'unsafe-inline'`) is what lets
      // Scalar's own inline init script run without loosening `script-src`
      // for the whole app. Passing a `nonce` to `apiReference()` also makes
      // Scalar choose its single-file UMD bundle over the ESM build (see
      // `getScriptTags`'s `useUmd` logic) — the ESM build's `import`-loaded
      // chunks can't carry a nonce at all, so it's the wrong choice under a
      // nonce-based policy regardless.
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'", 'https://cdn.jsdelivr.net', scriptSrcNonce],
          'style-src': ["'self'", 'https:', "'unsafe-inline'"],
        },
      },
    }),
  );

  // Only matters for local non-Docker dev, where web (:3000) calls api (:4000)
  // cross-origin. Behind Caddy everything is one origin and this is inert.
  app.enableCors({ origin: config.corsOrigins, credentials: true });

  // Swagger UI is never mounted — @nestjs/swagger is used purely as the
  // generator here. Scalar is the renderer, mounted at /reference (never
  // /docs, reserved for the frontend's MDX guides).
  mountScalarReference(app, buildOpenApiDocument(app));

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
