# Environment & secrets guide

Every setting the API reads, where it comes from, and what happens if it is wrong. The schema is
[`src/config/env.schema.ts`](../src/config/env.schema.ts) — this file explains it; that file is the truth. A
new variable goes in the schema, in [`.env.example`](../.env.example) and here in the same change.

**How settings load.** Real environment variables win over `.env` (dotenv never overrides), which is why the same
image works under `docker compose` (`env_file` → container env) and on a laptop (`.env`). Keys left blank in
`.env.example` (`AWS_REGION=`) are read as *absent*, so a freshly copied file boots.

**Two tiers.** *Required now* — boot fails, naming the key, if missing. *Required by its feature* — optional at boot;
the module that needs it says so the first time it is used (`STORAGE_DRIVER=s3` without AWS keys answers 503 on the
first upload, not at boot — nobody should need every third-party account to run the API).

Secrets are marked 🔒: never commit them, never paste them into a ticket, and rotate them if they appear in a log.
`src/core/redaction.ts` keeps tokens and secrets out of logs and telemetry, but that is a safety net, not permission.

## Core (required now)

| Variable | Default | Where it comes from | Notes |
|---|---|---|---|
| `NODE_ENV` | `development` | you | `production` in Docker (pino-pretty is not installed there). `test` is forced by the Vitest configs and switches off schedulers. |
| `PORT` | `4000` | you | Behind Caddy the API is reached as `api:4000`; nothing publishes it. |
| `LOG_LEVEL` | `info` | you | `fatal`…`trace`. Tests force `fatal`. |
| `DATABASE_URL` 🔒 | — | Neon console → **pooled** connection string (`-pooler` host), or a local Postgres | What the running app uses. |
| `DIRECT_URL` 🔒 | — | Neon console → **direct** connection string | Migrations only (`npm run migration:run`); PgBouncer's transaction pooling breaks DDL. For a local Postgres both URLs are the same. |
| `JWT_ACCESS_SECRET` 🔒 | — | `openssl rand -base64 48` | ≥ 16 characters. Signs 15-minute access tokens (HS256, claims: `sub` only). Changing it signs everyone out. |
| `JWT_REFRESH_SECRET` 🔒 | — | `openssl rand -base64 48` | ≥ 16 characters. Required but currently unused: refresh tokens are opaque and stored hashed. Kept so existing `.env` files stay valid. |
| `CORS_ORIGIN` | `http://localhost:3000` | you | Comma-separated. Only matters for non-Docker dev (web on :3000 calling API on :4000). Behind Caddy everything is one origin. |
| `APP_PUBLIC_URL` | `http://localhost:3000` | you | The browser-facing origin: links in emails (activation, invite, reset, invoice) and the OAuth redirect target. |

## Storage — `STORAGE_DRIVER`

| Variable | Default | Where it comes from |
|---|---|---|
| `STORAGE_DRIVER` | `s3` | `s3` is the graded path; `local` is an offline convenience (files under `STORAGE_LOCAL_PATH`, served by signed `GET /storage/local` links). |
| `STORAGE_LOCAL_PATH` | — | A folder, for `local`. |
| `AWS_REGION` | — | The bucket's region. |
| `AWS_S3_BUCKET` | — | A **private** bucket (block all public access — downloads are 5-minute presigned links). |
| `AWS_ACCESS_KEY_ID` 🔒 | — | An IAM user limited to `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on that bucket. |
| `AWS_SECRET_ACCESS_KEY` 🔒 | — | The same IAM user. |

## Mail — `MAIL_TRANSPORT`

| Variable | Default | Where it comes from |
|---|---|---|
| `MAIL_TRANSPORT` | `console` | `console` prints the rendered email (links included) to the log — how activation and invite links are read in development. `smtp` sends for real. |
| `SMTP_HOST` / `SMTP_PORT` | — / — | Your provider (SES, Mailgun, Postmark…). |
| `SMTP_USER` / `SMTP_PASSWORD` 🔒 | — | Your provider's SMTP credentials. |
| `MAIL_FROM` | `Gridline <no-reply@gridline.app>` | An address your provider has verified. |

## AI narrative — `AI_PROVIDER`

| Variable | Default | Notes |
|---|---|---|
| `AI_PROVIDER` | `off` | `off` skips the model: reports still ship their deterministic metrics. `gemini` adds a plain-language summary. The model only ever sees aggregates (means, percentages), never cell values. |
| `GEMINI_API_KEY` 🔒 | — | Google AI Studio → API keys. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Any Gemini model id your key can call. |

## Google sign-in (optional)

All three must be set, otherwise Google routes answer 503 and password auth is unaffected.

| Variable | Where it comes from |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud console → APIs & Services → Credentials → OAuth client (Web). |
| `GOOGLE_CLIENT_SECRET` 🔒 | The same client. |
| `GOOGLE_CALLBACK_URL` | `${public origin}/api/auth/google/callback`, and it must also be listed as an **authorized redirect URI** on the client. `http://localhost:3000/api/auth/google/callback` behind Caddy; `http://localhost:4000/auth/google/callback` for a bare `start:dev`. |

## Stripe Billing

Production uses Stripe as the authority for paid billing cycles, proration, invoices and payment
state. Gridline remains authoritative for permissions, plan limits, usage records and downgrade
validation. Configure the four immutable monthly prices, the file meter, a Customer Portal
configuration that permits only payment-method updates and invoice history, and the webhook
endpoint. Run `npm run stripe:verify-catalog` during deployment to prove the Dashboard resources
still match Gridline's product rules without adding a Stripe network dependency to every boot.

| Variable | Notes |
|---|---|
| `PAYMENTS_PROVIDER` | `stripe` in production; `none` keeps the deterministic local calculator available for offline development. |
| `ALLOW_UNPAID_PLANS` | Explicit production escape hatch. Keep `false` for the real product. |
| `STRIPE_SECRET_KEY` 🔒 / `STRIPE_WEBHOOK_SECRET` 🔒 | Stripe API key and signing secret. The callback verifies the exact raw body. |
| `STRIPE_WEBHOOK_ENDPOINT_ID` | `we_…` id checked by `stripe:verify-catalog`. |
| `STRIPE_BASIC_BASE_PRICE_ID` / `STRIPE_BASIC_SEAT_PRICE_ID` | Monthly $0 base and licensed $5 active-employee price. |
| `STRIPE_PREMIUM_BASE_PRICE_ID` / `STRIPE_PREMIUM_OVERAGE_PRICE_ID` | Monthly $300 base and graduated metered usage (1000 free, then $0.50/file). |
| `STRIPE_FILE_METER_ID` / `STRIPE_FILE_METER_EVENT_NAME` | Stripe meter and event name. Usage-event UUIDs are sent as idempotency identifiers. |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Portal configuration for cards and invoice history only. |
| `STRIPE_DUNNING_GRACE_DAYS` | Days after a failed invoice before the company is suspended; default 7. |

## Rate limiting & proxies

| Variable | Default | Notes |
|---|---|---|
| `RATE_LIMIT_ENABLED` | on | `false`/`0`/`off` disables plan-tiered throttling (Free 30 / Basic 120 / Premium 600 requests a minute per company, plus tight per-address limits on sign-in and email routes). Counters are in process memory: correct for one API instance. |
| `TRUST_PROXY` | `0` | How many reverse proxies sit in front of the API. `docker-compose.yml` sets `1` (Caddy). Too high lets a client choose its own address and dodge per-address limits; too low makes every request look like it came from the proxy. |

## Telemetry (optional) — Observe

| Variable | Notes |
|---|---|
| `OBSERVE_APP_KEY` 🔒 / `OBSERVE_APP_SECRET` 🔒 | From the Observe dashboard. **Both or neither**: the SDK does not no-op on empty credentials (it flushes and logs `Telemetry rejected (401)`), so the module is only registered when both exist. Without them the API runs clean, and the business metrics below are silent no-ops. |
| `GIT_SHA` | The commit being run (e.g. `git rev-parse --short HEAD` at deploy); shows in Observe's Releases. |

When Observe is on, requests are tagged with a `companyId` attribute and these counters are emitted:
`gridline.files.uploaded`, `gridline.quota.exceeded`, `gridline.subscription.changed`,
`gridline.billing.invoice_finalized` (label: `plan`).

## Not a runtime setting

| Variable | Notes |
|---|---|
| `DB_SKIP_CONNECT` | Set by `npm run docs:generate` so rendering the API docs never needs a database. |
| `.env.docker` (file) | Optional overrides applied **only inside containers** (see below). |

## Docker: why there is a second env file

`docker compose` loads `backend/.env` into the `migrate` and `api` containers. That file is written for the host, so its
database URLs say `localhost`, which inside a container means the container itself. Put the container's view of the
database in `backend/.env.docker` (gitignored; template: [`.env.docker.example`](../.env.docker.example)) — it is loaded
after `.env` and wins:

```bash
cp .env.docker.example .env.docker      # only needed with `--profile dev` (the local `db` service)
docker compose --profile dev up
```

With Neon there is nothing to override: the Neon URLs work from anywhere, so skip the file.

## Rotating and where secrets live

- **JWT secrets, database URLs, AWS/SMTP/Gemini/Google/Observe credentials** live in the deployment's secret store (or a
  local, gitignored `.env`). Nothing secret is in `docker-compose.yml`, the Dockerfile or the repository.
- **Rotate immediately** if a value reaches a log, a screenshot, a chat or a commit — rewriting history does not un-leak it.
- **Application secrets are never stored in plain text:** passwords are scrypt hashes; refresh, activation, invite,
  reset, OAuth-exchange and API-key tokens are stored as SHA-256 hashes (an API key is shown once, at creation).
- **Tests** need a reachable Postgres (`DATABASE_URL` / `DIRECT_URL`, a local container is fine) and the two JWT secrets;
  mail is captured, storage is a temp folder and the AI provider is a fake, so no other secret is needed. The integration
  suite truncates tables, so never point it at a database you care about.
