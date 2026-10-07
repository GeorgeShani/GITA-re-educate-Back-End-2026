import '../load-env.js'; // MUST be the first import — see load-env.ts
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { GoogleOAuthProvider } from '../auth/oauth/google-oauth.provider.js';
import { AppConfigModule } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';
import { APP_CONFIG } from '../config/load-config.js';
import { AI_PROVIDER, type AiProvider } from '../core/ai/ai-provider.js';
import { AiModule } from '../core/ai/ai.module.js';
import { CoreModule } from '../core/core.module.js';
import { BRAND } from '../core/mail/brand.js';
import { MAIL_TRANSPORT, type MailTransport } from '../core/mail/mail-transport.js';
import { MailModule } from '../core/mail/mail.module.js';
import { MailService } from '../core/mail/mail.service.js';
import { StorageModule } from '../core/storage/storage.module.js';
import { StorageService } from '../core/storage/storage.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { verifyStripeCatalog } from '../payments/stripe-catalog.js';
import { fetchStripeCatalog } from '../payments/stripe-catalog-fetch.js';
import {
  type Check,
  exitCodeFor,
  expectedGoogleCallbackUrl,
  expectedStripeWebhookUrl,
  fail,
  formatReport,
  googleRefusalReason,
  pass,
  runChecks,
  skip,
  stripeKeyMode,
} from './integration-checks.js';

/**
 * `npm run verify:integrations` → `node dist/ops/verify-integrations.js [--send-to you@example.com]`.
 *
 * Proves, against the REAL services this deployment is configured for, that each of them answers: the database, the file
 * bucket, the brand-assets CDN, the mail server, Stripe, Google sign-in, the AI model and telemetry. Every check goes through
 * the same provider the app uses, so a pass means the app will work, not that a second client did. It changes nothing that
 * lasts: the bucket object it writes is deleted, and mail is sent only when `--send-to` asks for it.
 *
 * A standalone application context: no HTTP, no task runner, no schedule. Exit code 1 when anything fails.
 */
@Module({
  imports: [AppConfigModule, ClsModule.forRoot({ global: true }), CoreModule, DatabaseModule, StorageModule, AiModule, MailModule],
})
class VerifyIntegrationsCliModule {}

function sendToFromArgs(argv: readonly string[]): string | null {
  const index = argv.indexOf('--send-to');
  const value = index === -1 ? undefined : argv[index + 1];
  return value && !value.startsWith('--') ? value : null;
}

const SAMPLE_QUESTION = { question: 'total revenue by region', columns: [{ name: 'region', type: 'text' }, { name: 'revenue', type: 'number' }] };

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(VerifyIntegrationsCliModule, { logger: ['error', 'warn'] });
  try {
    const config = app.get<AppConfig>(APP_CONFIG);
    const sendTo = sendToFromArgs(process.argv.slice(2));

    const checks: Check[] = [
      {
        name: 'Postgres (Neon)',
        run: async () => {
          const dataSource = app.get(DataSource);
          await dataSource.query('SELECT 1');
          return (await dataSource.showMigrations())
            ? fail('connected, but migrations are pending: run `npm run migration:run`')
            : pass('connected, no migrations pending');
        },
      },
      {
        name: 'S3 (customer files)',
        run: async () => {
          if (config.STORAGE_DRIVER === 'local') return skip('STORAGE_DRIVER=local: files are on disk, nothing to reach');
          const storage = app.get(StorageService);
          const key = `healthchecks/${randomUUID()}.txt`;
          const body = Buffer.from(`gridline integration check ${new Date().toISOString()}`);
          await storage.put(key, body, 'text/plain');
          try {
            const back = await storage.get(key);
            if (!back.equals(body)) return fail('wrote an object and read different bytes back');
            let listed = false;
            for await (const object of storage.list('healthchecks/')) if (object.key === key) listed = true;
            if (!listed) return fail('wrote an object but a listing did not show it (does the IAM user have s3:ListBucket?)');
            const link = await storage.downloadLink(key, 'check.txt');
            const download = await fetch(link.url);
            if (!download.ok || (await download.text()) !== body.toString()) {
              return fail(`the presigned download link answered ${download.status}`);
            }
            return pass('put, get, list, a presigned download and delete all worked');
          } finally {
            await storage.delete(key);
          }
        },
      },
      {
        name: 'CloudFront (brand assets)',
        run: async () => {
          if (!config.ASSETS_BASE_URL) return skip('ASSETS_BASE_URL is not set: emails use a text wordmark');
          const url = `${config.ASSETS_BASE_URL}${BRAND.logoPath}`;
          const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
          const type = response.headers.get('content-type') ?? '';
          if (!response.ok) return fail(`${url} answered ${response.status}`);
          if (!type.startsWith('image/')) return fail(`${url} answered ${type || 'no content type'}, not an image`);
          return pass(`${url} is ${type}`);
        },
      },
      {
        name: 'SMTP (mail)',
        run: async () => {
          if (config.MAIL_TRANSPORT !== 'smtp') return skip('MAIL_TRANSPORT=console: mail is printed to the log');
          const transport = app.get<MailTransport>(MAIL_TRANSPORT, { strict: false });
          if (!transport.verify) return fail('this mail transport cannot verify itself');
          await transport.verify();
          if (!sendTo) return pass(`logged in to ${config.SMTP_HOST}:${config.SMTP_PORT} (pass --send-to <address> to send a real message)`);
          await app.get(MailService).send({ template: 'password_changed', to: sendTo, vars: { fullName: 'Integration Check' } });
          return pass(`logged in to ${config.SMTP_HOST}:${config.SMTP_PORT} and sent a message to ${sendTo}`);
        },
      },
      {
        name: 'Stripe',
        run: async () => {
          if (config.PAYMENTS_PROVIDER !== 'stripe') return skip('PAYMENTS_PROVIDER=none: payments are simulated');
          const mode = stripeKeyMode(config.STRIPE_SECRET_KEY ?? '');
          if (!mode) return fail('STRIPE_SECRET_KEY is not a secret key (sk_… or rk_…)');
          const snapshot = await fetchStripeCatalog(config);
          verifyStripeCatalog(snapshot);
          const endpoint = z.object({ url: z.string() }).safeParse(snapshot.webhookEndpoint);
          const registered = endpoint.success ? endpoint.data.url : null;
          const expected = expectedStripeWebhookUrl(config.APP_PUBLIC_URL);
          if (registered !== expected) {
            return fail(`the webhook endpoint posts to ${registered ?? 'an unknown address'}, but this deployment is ${expected}`);
          }
          return pass(`${mode} mode: 4 prices, the meter, the portal and the webhook endpoint (${expected}) are all as expected`);
        },
      },
      {
        name: 'Google sign-in',
        run: async () => {
          const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = config;
          if (!GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_SECRET && !GOOGLE_CALLBACK_URL) return skip('no GOOGLE_* variables: Google sign-in is off');
          if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_CALLBACK_URL) {
            return fail('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL must all be set');
          }
          const expected = expectedGoogleCallbackUrl(config.APP_PUBLIC_URL);
          if (GOOGLE_CALLBACK_URL !== expected) return fail(`GOOGLE_CALLBACK_URL is ${GOOGLE_CALLBACK_URL}, but this deployment is ${expected}`);
          // Ask Google to start a sign-in with exactly what the app would send. A client or redirect URI it does not know is
          // refused with an error page; a good one is sent on to its sign-in page. No account is involved.
          const provider = new GoogleOAuthProvider({ clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, callbackUrl: GOOGLE_CALLBACK_URL });
          const response = await fetch(provider.authorizationUrl('verify'), { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
          const refusal = googleRefusalReason(response.status, response.status >= 400 ? await response.text() : '');
          return refusal ? fail(refusal) : pass('Google accepted the client id and the redirect URI (the client secret is checked at the first real sign-in)');
        },
      },
      {
        name: 'Gemini (AI)',
        run: async () => {
          const ai = app.get<AiProvider>(AI_PROVIDER);
          if (ai.name === 'off') return skip('AI_PROVIDER=off: report summaries and "ask in words" are switched off');
          const plan = await ai.planQuery(SAMPLE_QUESTION);
          if (!plan) return fail(`${ai.model ?? 'the model'} gave no usable answer: check GEMINI_API_KEY and GEMINI_MODEL (the reason is in the warning above)`);
          return pass(`${ai.model} planned a query for a sample question`);
        },
      },
      {
        name: 'Observe (telemetry)',
        // Telemetry is fire-and-forget and has no read-back, so this can only say what is configured.
        run: async () =>
          skip(
            config.observeEnabled
              ? 'credentials are set; nothing can be proved from here, look for the app in the Observe dashboard'
              : 'no OBSERVE_* credentials: telemetry is off',
          ),
      },
    ];

    const outcomes = await runChecks(checks);
    process.stdout.write(`\n${formatReport(outcomes)}`);
    process.exitCode = exitCodeFor(outcomes);
  } finally {
    await app.close();
  }
}

await main();
