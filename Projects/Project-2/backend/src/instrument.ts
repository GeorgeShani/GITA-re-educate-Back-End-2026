// Must be imported before any other module — see main.ts, which does
// `import './instrument'` as its very first line. Sentry's own docs:
// "Ensure to call this before requiring any other modules!" so its
// auto-instrumentation can patch things before they're first used.
// Source: https://docs.sentry.io/platforms/javascript/guides/nestjs/
// (verified against the installed @sentry/nestjs@10.71.0).
//
// Reads .env directly via process.loadEnvFile — same pattern every
// standalone script (scripts/*.ts) already uses — rather than trusting
// @nestjs/config's ConfigModule, which hasn't run yet at this point:
// this file is imported before app.module.ts, so ConfigModule.forRoot()
// (which loads .env internally) hasn't executed.
import { existsSync } from 'node:fs';

import * as Sentry from '@sentry/nestjs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // 100% in dev (cheap, low volume); sampled in production to control
    // cost once this ever actually deploys with real traffic.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
}
