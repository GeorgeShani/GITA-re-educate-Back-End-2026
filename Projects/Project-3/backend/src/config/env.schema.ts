import { z } from 'zod';

/**
 * The environment contract, in two tiers by lifecycle.
 *
 * TIER 1 — required now. A missing value here fails boot, because nothing in
 * the app works without it.
 *
 * TIER 2 — required by its phase. Present in `.env.example` but optional here;
 * the module that needs one asserts its own requirement when it is first used
 * (a storage driver of `s3` demands the AWS keys, `MAIL_TRANSPORT=smtp` demands
 * the SMTP host, and so on). Validating them as required here would mean nobody
 * can boot the app until every third-party account exists, which is exactly the
 * friction the offline-first defaults are meant to remove.
 *
 * Every optional key tolerates the empty string, because `.env.example` ships
 * keys present but unset (`AWS_REGION=`) and dotenv parses that as `''`, not
 * `undefined`. Without the tolerance a freshly copied `.env` fails boot while
 * doing exactly what an example file is supposed to do.
 */

/** Optional string that treats `''` (a copied-but-unset key) as absent. */
const optionalString = () =>
  z
    .string()
    .transform((value) => (value === '' ? undefined : value))
    .optional();

/** Optional URL that treats `''` as absent but still rejects malformed values. */
const optionalUrl = () =>
  z
    .string()
    .transform((value) => (value === '' ? undefined : value))
    .optional()
    .refine(
      (value) => value === undefined || URL.canParse(value),
      'must be a valid URL',
    );

/** `PORT=4000` arrives as the string `'4000'`; coerce, then bound it. */
const port = () => z.coerce.number().int().min(1).max(65535);

const booleanFlag = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      return ['true', '1', 'on'].includes(value.toLowerCase());
    });

/**
 * Tier 1 string. Zod's default for a missing key is "expected string, received
 * undefined", which reads like a type error rather than a setup instruction —
 * this says what the operator actually needs to do.
 */
const requiredString = (min = 1, hint = 'is required') =>
  z
    .string({ error: (issue) => (issue.input === undefined ? hint : undefined) })
    .min(min, min > 1 ? `must be at least ${min} characters` : hint);

export const envSchema = z
  .object({
    // ---- Tier 1: required now ------------------------------------------------
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: port().default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),

    /**
     * Neon's *pooled* connection — what the running app uses.
     * Required from Phase 2 onward; see the note on `DIRECT_URL`.
     */
    DATABASE_URL: requiredString(),
    /**
     * Neon's *direct* connection — migrations only. PgBouncer's transaction
     * pooling mode breaks some DDL and prepared statements, so the migration
     * runner deliberately does not share the app's URL.
     */
    DIRECT_URL: requiredString(),

    JWT_ACCESS_SECRET: requiredString(16),
    JWT_REFRESH_SECRET: requiredString(16),

    /**
     * Comma-separated. Only matters for local non-Docker development, where the
     * web app on :3000 calls the API on :4000 cross-origin. Behind Caddy
     * everything is one origin and this is unused.
     */
    CORS_ORIGIN: z.string().default('http://localhost:3000'),

    /**
     * The browser-facing origin — used to build links in emails (activation,
     * invite, password reset) and, from Phase 5, the OAuth redirect target.
     * The shared Caddy origin in Docker; `localhost:3000` for local non-Docker
     * dev, where the web app owns that port.
     */
    APP_PUBLIC_URL: z.string().default('http://localhost:3000'),

    // ---- Tier 2: required by its phase --------------------------------------
    /** `local` is an offline-dev convenience; `s3` is the graded path. */
    STORAGE_DRIVER: z.enum(['s3', 'local']).default('s3'),
    STORAGE_LOCAL_PATH: optionalString(),
    AWS_REGION: optionalString(),
    AWS_S3_BUCKET: optionalString(),
    AWS_ACCESS_KEY_ID: optionalString(),
    AWS_SECRET_ACCESS_KEY: optionalString(),

    /** `console` prints the rendered email instead of sending it. */
    MAIL_TRANSPORT: z.enum(['smtp', 'console']).default('console'),
    SMTP_HOST: optionalString(),
    SMTP_PORT: port().optional(),
    SMTP_USER: optionalString(),
    SMTP_PASSWORD: optionalString(),
    MAIL_FROM: z.string().default('Gridline <no-reply@gridline.app>'),

    /** `off` skips the Gemini call; the deterministic metrics still render. */
    AI_PROVIDER: z.enum(['gemini', 'off']).default('off'),
    GEMINI_API_KEY: optionalString(),
    GEMINI_MODEL: z.string().default('gemini-3.8-flash'),

    /**
     * Both must be present for telemetry to be registered at all. The SDK does
     * NOT no-op on empty credentials — it starts, flushes, and logs
     * `Telemetry rejected (401)` per flush — so `AppModule` omits the module
     * entirely unless both of these are set.
     */
    OBSERVE_APP_KEY: optionalString(),
    OBSERVE_APP_SECRET: optionalString(),
    /** Surfaces in Observe's Releases view. Set from the commit SHA in CI. */
    GIT_SHA: optionalString(),

    GOOGLE_CLIENT_ID: optionalString(),
    GOOGLE_CLIENT_SECRET: optionalString(),
    GOOGLE_CALLBACK_URL: optionalUrl(),

    /** Stripe Billing is optional for offline development and mandatory in production. */
    PAYMENTS_PROVIDER: z.enum(['stripe', 'none']).default('none'),
    ALLOW_UNPAID_PLANS: booleanFlag(false),
    STRIPE_SECRET_KEY: optionalString(),
    STRIPE_WEBHOOK_SECRET: optionalString(),
    STRIPE_WEBHOOK_ENDPOINT_ID: optionalString(),
    STRIPE_BASIC_BASE_PRICE_ID: optionalString(),
    STRIPE_BASIC_SEAT_PRICE_ID: optionalString(),
    STRIPE_PREMIUM_BASE_PRICE_ID: optionalString(),
    STRIPE_PREMIUM_OVERAGE_PRICE_ID: optionalString(),
    STRIPE_FILE_METER_EVENT_NAME: optionalString(),
    STRIPE_FILE_METER_ID: optionalString(),
    STRIPE_PORTAL_CONFIGURATION_ID: optionalString(),
    STRIPE_DUNNING_GRACE_DAYS: z.coerce.number().int().min(1).max(30).default(7),

    /** Public brand assets served through CloudFront. Customer files never use this origin. */
    ASSETS_BASE_URL: optionalUrl(),

    /**
     * Plan-tiered request throttling (Phase 11). On by default; the test config switches
     * it off (specs make hundreds of requests per company) and the throttling specs turn it on.
     */
    RATE_LIMIT_ENABLED: z
      .string()
      .optional()
      .transform((value) => value === undefined || value === '' || !['false', '0', 'off'].includes(value.toLowerCase())),

    /**
     * How many reverse proxies sit in front of the API (Express `trust proxy`). 0 = none, so
     * `req.ip` is the socket peer; 1 = Caddy in Docker, so `req.ip` is the real client from
     * `X-Forwarded-For`. Too high lets a client spoof its address (and dodge IP throttling);
     * too low makes every request look like it came from the proxy.
     */
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

    /**
     * Set by `docs:generate` so the DataSource is constructed but never
     * connected — rendering documentation should not require a live database.
     */
    DB_SKIP_CONNECT: z
      .string()
      .optional()
      .transform((value) => value === '1' || value === 'true'),
  })
  .superRefine((env, context) => {
    const issue = (path: string, message: string): void => {
      context.addIssue({ code: 'custom', path: [path], message });
    };

    if (env.PAYMENTS_PROVIDER === 'stripe') {
      const required: Record<string, string | undefined> = {
        STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
        STRIPE_WEBHOOK_ENDPOINT_ID: env.STRIPE_WEBHOOK_ENDPOINT_ID,
        STRIPE_BASIC_BASE_PRICE_ID: env.STRIPE_BASIC_BASE_PRICE_ID,
        STRIPE_BASIC_SEAT_PRICE_ID: env.STRIPE_BASIC_SEAT_PRICE_ID,
        STRIPE_PREMIUM_BASE_PRICE_ID: env.STRIPE_PREMIUM_BASE_PRICE_ID,
        STRIPE_PREMIUM_OVERAGE_PRICE_ID: env.STRIPE_PREMIUM_OVERAGE_PRICE_ID,
        STRIPE_FILE_METER_EVENT_NAME: env.STRIPE_FILE_METER_EVENT_NAME,
        STRIPE_FILE_METER_ID: env.STRIPE_FILE_METER_ID,
        STRIPE_PORTAL_CONFIGURATION_ID: env.STRIPE_PORTAL_CONFIGURATION_ID,
      };
      for (const [key, value] of Object.entries(required)) {
        if (!value) issue(key, `is required when PAYMENTS_PROVIDER=stripe`);
      }
    }

    if (env.NODE_ENV !== 'production') return;

    if (env.MAIL_TRANSPORT !== 'smtp') {
      issue('MAIL_TRANSPORT', 'must be smtp in production');
    }
    if (!URL.canParse(env.APP_PUBLIC_URL) || new URL(env.APP_PUBLIC_URL).hostname === 'localhost') {
      issue('APP_PUBLIC_URL', 'must be a public URL in production');
    }
    for (const [key, secret] of [
      ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
      ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
    ]) {
      if (secret.length < 32 || secret.toLowerCase().includes('change-me')) {
        issue(key, 'must be at least 32 characters and not an example placeholder in production');
      }
    }
    if (env.PAYMENTS_PROVIDER !== 'stripe' && !env.ALLOW_UNPAID_PLANS) {
      issue(
        'PAYMENTS_PROVIDER',
        'must be stripe in production unless ALLOW_UNPAID_PLANS=true is explicitly set',
      );
    }
    if (env.ASSETS_BASE_URL && new URL(env.ASSETS_BASE_URL).protocol !== 'https:') {
      issue('ASSETS_BASE_URL', 'must use https in production');
    }
  })
  .transform((env) => ({
    ...env,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    /** Telemetry is only wired when both halves of the credential exist. */
    observeEnabled: Boolean(env.OBSERVE_APP_KEY && env.OBSERVE_APP_SECRET),
    /** Google sign-in is registered only when all three halves exist; otherwise its routes answer 503. */
    googleOAuthEnabled: Boolean(
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL,
    ),
    corsOrigins: env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  }));

export type AppConfig = Readonly<z.infer<typeof envSchema>>;
