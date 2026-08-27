# Getting every secret in `.env`

Companion to `.env.example`. Covers every variable S4–S10 touch, where it comes
from, and — separately, because it isn't an env var at all — the one manual
Atlas Search setup step S7's product search needs.

Start by copying the template:

```bash
cp backend/.env.example backend/.env
```

Then fill it in section by section below. Nothing here needs to happen in
order except **Mongo and Redis first** — everything else the app boots
without (S1's Joi schema only `.required()`s those two, JWT_SECRET/
JWT_REFRESH_SECRET/COOKIE_SECRET, per `src/config/env.validation.ts`).

## TL;DR

| Variable | Needed for | Get it from |
|---|---|---|
| `MONGODB_URI` | everything | Atlas — [§1](#1-mongodb-atlas-required) |
| `REDIS_URL` | everything (BullMQ) | Railway/Upstash — [§2](#2-redis-required) |
| `JWT_SECRET` | everything (auth) | self-generated — [§3](#3-self-generated-secrets-required) |
| `JWT_REFRESH_SECRET` | everything (auth) | self-generated — [§3](#3-self-generated-secrets-required) |
| `COOKIE_SECRET` | S8 guest carts | self-generated — [§3](#3-self-generated-secrets-required) |
| `PAYMENT_PROVIDER` | S9 checkout | set to `mock` and skip Stripe entirely, or `stripe` — [§4](#4-stripe-s9-checkout--payments) |
| `STRIPE_SECRET_KEY` | S9, only if `PAYMENT_PROVIDER=stripe` | Stripe Dashboard — [§4](#4-stripe-s9-checkout--payments) |
| `STRIPE_WEBHOOK_SECRET` | S9, only if `PAYMENT_PROVIDER=stripe` | Stripe CLI (dev) / Dashboard (prod) — [§4](#4-stripe-s9-checkout--payments) |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | S6 media, S7 seed images | Cloudinary Dashboard — [§5](#5-cloudinary-s6-media--s7-seed-images) |
| `CLOUDINARY_UPLOAD_PRESET` | nothing right now | leave blank — [§5](#5-cloudinary-s6-media--s7-seed-images) |
| `CLOUDINARY_WEBHOOK_SECRET` | nothing right now | leave blank — [§5](#5-cloudinary-s6-media--s7-seed-images) |
| `MAIL_PROVIDER=console` | nothing — this is the default | already set, skip §6 entirely |
| `RESEND_API_KEY`, `MAIL_*` | only if you switch `MAIL_PROVIDER=resend` | Resend Dashboard — [§6](#6-resend-s4-email-optional) |
| `PEXELS_API_KEY` | `npm run seed:catalog` only | Pexels — [§7](#7-pexels-seed-script-only) |
| `GEMINI_API_KEY` | nothing yet (S12, unbuilt) | Google AI Studio — [§8](#8-gemini-future-s12-not-needed-yet) |
| `products_search` index | S7 catalog search/typeahead | **not an env var** — Atlas UI — [§9](#9-atlas-search-index-not-an-env-var) |
| first admin account | Phase 6 `/admin/*` routes | **not an env var** — `npm run promote-admin` — [§10](#10-bootstrapping-the-first-admin-not-an-env-var) |

## 1. MongoDB Atlas (required)

Transactions *and* change streams (the outbox relay, S2) both need a real
replica set — a bare standalone `mongod` won't do.

1. Sign up at [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) — no card required for the free tier.
2. Create a project, then **Build a Database → M0 Free**. Any region is fine; M0 is provisioned as a 3-node replica set automatically, which is exactly what's needed.
3. **Database Access** → add a database user with username/password auth (not the OAuth option) and note the password somewhere — Atlas only shows it once.
4. **Network Access** → add an IP entry. For local dev, "Allow Access from Anywhere" (`0.0.0.0/0`) is the path of least resistance; tighten it before this ever touches production data.
5. **Database → Connect → Drivers → Node.js**, copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```
   Two edits before it's usable: swap in the real password, and **insert a database name** before the `?` — Atlas's copy button omits one:
   ```
   MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/golf-storefront?retryWrites=true&w=majority
   ```

## 2. Redis (required)

BullMQ (the queue backbone under `src/core/queues/`) needs this. Either works:

**Railway** — [railway.app](https://railway.app), New Project → Deploy Redis from the template gallery → open the Redis service → **Connect** tab → copy the `REDIS_URL` it hands you directly (already in `redis://default:<password>@<host>:<port>` form).

**Upstash** — [upstash.com](https://upstash.com), Create Database (Redis, any region) → copy the **ioredis-compatible** connection string it shows (starts `rediss://` — TLS). Either scheme works here: `BullModule.forRootAsync` in `src/app.module.ts` already sets `maxRetriesPerRequest: null, enableReadyCheck: false`, which is the one thing serverless Redis providers like Upstash require that a default ioredis config doesn't set.

```
REDIS_URL=<either of the above, verbatim>
```

## 3. Self-generated secrets (required)

`JWT_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` are yours to invent —
nothing external issues them. Joi requires 16+ characters each
(`env.validation.ts`); generate three independent 64-character hex strings
(works identically in PowerShell, Git Bash, or a Node REPL):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it three times, paste one output into each of the three variables. Keep
them distinct on purpose — that's why `JWT_REFRESH_SECRET` is separate from
`JWT_SECRET` (`src/auth/auth.module.ts`'s comment on `REFRESH_JWT_SERVICE_TOKEN`
spells out why: a leaked access-token secret shouldn't be enough to forge a
refresh token).

## 4. Stripe (S9 checkout & payments)

**You can skip this whole section.** `.env.example` ships `PAYMENT_PROVIDER=mock`,
which runs the entire checkout saga — PaymentIntent creation, webhook-driven
confirm/cancel, saved "cards" — through `MockPaymentProvider` with no Stripe
account at all (`POST /payments/mock/:id/succeed|fail` stands in for the
webhook). Come back to this section whenever you actually want to exercise
real Stripe test-mode payments.

1. Sign up at [dashboard.stripe.com/register](https://dashboard.stripe.com/register). Stay in **test mode** (the toggle in the Dashboard's left sidebar) — every key below should start with a `_test_` segment.
2. **Developers → API keys** → copy the **Secret key** (`sk_test_...`):
   ```
   PAYMENT_PROVIDER=stripe
   STRIPE_SECRET_KEY=sk_test_...
   ```
3. `STRIPE_WEBHOOK_SECRET` differs for local dev vs. a deployed URL:
   - **Local dev** — install the [Stripe CLI](https://docs.stripe.com/stripe-cli) (Windows: `scoop install stripe`, or grab the `.exe` from the [GitHub releases](https://github.com/stripe/stripe-cli/releases/latest)), then:
     ```bash
     stripe login
     stripe listen --forward-to localhost:3000/api/v1/payments/webhooks/stripe
     ```
     It prints a `whsec_...` on startup — that's the secret, but it's only valid while `stripe listen` keeps running. Restarting it issues a new one.
   - **Deployed** — **Developers → Webhooks → Add endpoint**, URL `https://<your-domain>/api/v1/payments/webhooks/stripe`, events `payment_intent.succeeded` and `payment_intent.payment_failed` (the only two `PaymentsController` acts on). The endpoint's **Signing secret** is the persistent `whsec_...`.
4. Test-mode card numbers (no real charge ever happens): `4242 4242 4242 4242` (any future expiry, any CVC) succeeds; `4000 0000 0000 0002` always declines — useful for exercising the saga's `CancelOrderCommand` compensation path.

## 5. Cloudinary (S6 media, S7 seed images)

1. Sign up at [cloudinary.com/users/register/free](https://cloudinary.com/users/register/free).
2. The Dashboard home page shows **Cloud name**, **API Key**, and **API Secret** immediately after signup — no configuration needed:
   ```
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```
3. Leave `CLOUDINARY_UPLOAD_PRESET` and `CLOUDINARY_WEBHOOK_SECRET` blank. Neither is actually read anywhere in the current code — `CloudinaryStorageProvider.getUploadSignature` (`src/media/providers/cloudinary-storage.provider.ts`) signs only `{ timestamp, folder }`, no preset, and nothing subscribes to a Cloudinary-side webhook (asset registration happens via an explicit backend call after the browser's direct upload, not a webhook callback). Both are in the Joi schema as `optional()` for exactly this reason — they're there for if that changes, not because anything needs them today.

## 6. Resend (S4 email, optional)

`.env.example` ships `MAIL_PROVIDER=console`, which just logs rendered emails
to stdout — genuinely sufficient for developing every other slice, since
nothing else in S4–S10 branches on whether an email actually sent. Set this
up only when you want to see real emails land in an inbox.

1. Sign up at [resend.com](https://resend.com).
2. **API Keys** → create one → `RESEND_API_KEY=re_...`.
3. Without a verified sending domain, Resend only lets you send to *your own*
   account email — fine for solo dev. **Domains → Add Domain** and its DNS
   records if you want to send anywhere else.
4. ```
   MAIL_PROVIDER=resend
   RESEND_API_KEY=re_...
   MAIL_FROM=orders@<your-verified-domain-or-onboarding@resend.dev>
   MAIL_FROM_NAME=3legant Golf
   ```
5. `MAIL_WEBHOOK_SECRET` (delivery/bounce/complaint events, verified in
   `src/notifications/mail/resend-mail.provider.ts` via hand-rolled Svix
   signature verification) comes from **Webhooks → Add Endpoint** in the
   Resend dashboard, pointed at `https://<your-domain>/api/v1/notifications/webhooks/resend` — needs a public URL, so this one waits until you deploy or tunnel with something like `ngrok`.
6. `MAIL_DEV_REDIRECT` — set this to your own inbox address. In any
   non-production `NODE_ENV`, every outgoing recipient gets rewritten to it
   unless the address is in `MAIL_DEV_ALLOWLIST` (comma-separated) — this is
   the dev-safety gate the S4 plan called out as a hard requirement, so
   seeded/test accounts can never accidentally mail a real stranger.

## 7. Pexels (seed script only)

Only `npm run seed:catalog` reads this — the running API never does.

1. Sign up at [pexels.com/api](https://www.pexels.com/api/) → your key is issued instantly on the API page, no approval wait.
2. ```
   PEXELS_API_KEY=...
   ```

## 8. Gemini (future S12, not needed yet)

Nothing in S4–S10 calls this — it's in the Joi schema as `optional()` purely
so S12 (the AI assistant slice, not yet built) doesn't need another env
validation pass later. Skip it for now; when S12 lands:

1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) → Create API key. The free tier is enough for development.
2. `GEMINI_API_KEY=...`

## 9. Atlas Search index (not an env var)

S7's product search and typeahead (`src/search/providers/atlas-search.provider.ts`)
run entirely through Mongo's `$search` aggregation stage, which requires a
search index provisioned on the Atlas side — this doesn't come from
`MONGODB_URI` or any Mongoose schema, and boots/deploys silently succeed
without it (the endpoints just return empty results until the index exists).

1. Atlas UI → your cluster → **Search** tab → **Create Search Index**.
2. Choose **JSON Editor** (not the visual builder — faster and exact) → select the `products` collection in your database.
3. Name the index **exactly** `products_search` — hardcoded as `SEARCH_INDEX_NAME` in `atlas-search.provider.ts`, and paste:
   ```json
   {
     "mappings": {
       "dynamic": false,
       "fields": {
         "name": [
           { "type": "string" },
           { "type": "autocomplete" }
         ],
         "brand": { "type": "string" },
         "description": { "type": "string" },
         "tags": { "type": "string" }
       }
     }
   }
   ```
   `name` needs *both* index types on purpose: plain `string` is what the weighted `compound.should` text search in `searchProducts()` queries against, while `autocomplete` is what `typeahead()`'s `$search.autocomplete` operator requires — a field indexed only as `string` doesn't support the autocomplete operator at all, and it's a different Lucene analyzer under the hood (edge n-grams vs. standard tokenization).
   `categoryId`, `basePriceMinor`, and `publishedAt` deliberately aren't in this mapping — the provider filters those with a plain `$match` stage after `$search`, not Atlas Search filter clauses, so they don't need to be indexed here.
4. Create, then wait for status to flip from *Build in Progress* to **Active** (a minute or two on an empty/freshly-seeded collection). Search endpoints 500 or return nothing sensible until it's Active.
5. Re-run this whenever `Product`'s searchable fields change — the index doesn't auto-update its mapping when the Mongoose schema does.

## 10. Bootstrapping the first admin (not an env var)

Every `/admin/*` route added in Phase 6 requires an `ADMIN`/`MANAGER`/
`SUPPORT`/`EDITOR` role, and registration always assigns a brand-new account
`[Role.CUSTOMER]` — no route can promote a user who isn't already staff, so
the very first admin has to come from a script, not the API:

```bash
# after the account has registered normally through /auth/register
npm run promote-admin -- you@example.com
```

Defaults to `Role.ADMIN`; pass a second argument (`manager` | `support` |
`editor`) for a narrower role instead — see
`src/common/constants/admin-roles.constant.ts` for what each one can reach.
Once you have one admin, `PATCH /admin/users/:id/roles` handles promoting
everyone else.

## Verifying it all works

```bash
npm run start:dev
```

- `GET http://localhost:3000/health` — green for Mongo and Redis. Cloudinary/Stripe don't have their own health checks; a failed `getOrThrow` on first use is how a missing key surfaces instead.
- `http://localhost:3000/api` — Swagger UI, should list every module's routes including the new `users`, `wishlist`, `returns`, and `payment-methods` tags from S10.
- `npm run mail:preview` — renders both S4 templates to local HTML files regardless of `MAIL_PROVIDER`.
- `npm run seed:commerce` then `npm run seed:catalog` — needs Mongo + Cloudinary + Pexels; ~80 products should land, idempotently re-runnable.
- Register a user, place an order with `PAYMENT_PROVIDER=mock` (or a real `4242...` test card under `stripe`), and confirm the correlation id shows up across the HTTP log line, the outbox row, and (if `MAIL_PROVIDER=console`) the printed confirmation email — the event-trace check from the plan's own verification section.

## Hygiene

- `.env` is already git-ignored by the Nest scaffold's default `.gitignore` — double check before a first commit if you ever move or rename it.
- Every key above is safe to rotate independently at any time except `COOKIE_SECRET` (rotating it invalidates every outstanding guest-cart cookie — harmless, just an inconvenience) and the JWT secrets (rotating either logs out every session immediately).
- Stripe and Resend keys shown here are **test-mode only** — swapping to live-mode keys is a deliberate, separate decision this guide doesn't cover.
