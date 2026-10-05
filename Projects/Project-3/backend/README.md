# Gridline API

The API behind Gridline, a multi-tenant SaaS where a company's spreadsheets live: checked on arrival, scanned for personal
data, cleaned into new versions, compared row by row, and open to questions. NestJS 12 (ESM), TypeORM 1.x, Neon Postgres.
The whole project is described in [`../README.md`](../README.md), and putting it on a server in
[`../DEPLOYMENT.md`](../DEPLOYMENT.md). See [`../SCOPE.md`](../SCOPE.md) for the full design and grading rubric, and
[`AGENTS.md`](./AGENTS.md) for the coding conventions this codebase follows.
**New here? Start with [`docs/OVERVIEW.md`](./docs/OVERVIEW.md)** — what the app is, every feature and why it exists.
For a requirement-by-requirement implementation check, see
[`docs/IMPLEMENTATION_AUDIT.md`](./docs/IMPLEMENTATION_AUDIT.md).

## Setup

Needs Node.js 24 and a Postgres database (a free Neon project, or the local one below).

```bash
npm install
cp .env.example .env     # fill in DATABASE_URL and DIRECT_URL
npm run build
npm run migration:run
npm run seed:all         # optional: the demo company and a test company
npm run dev              # http://localhost:4000, API reference at /reference
```

For development without AWS, uncomment `STORAGE_DRIVER=local` in `.env`. The other defaults are already the offline ones
(`MAIL_TRANSPORT=console`, `PAYMENTS_PROVIDER=none`, `AI_PROVIDER=off`).

Every key in `.env` is validated at boot by `src/config/env.schema.ts`. A
missing required key exits the process non-zero before it starts listening,
naming the key. `.env.example` documents the graded default for each var,
with the offline-dev fallback commented beneath it.

## Database — Neon pooled vs. direct

Neon fronts every connection with PgBouncer in transaction-pooling mode,
which breaks DDL and prepared statements. That's why there are **two**
connection strings, not one:

| Var            | Endpoint                                               | Used by                                                                                       |
| -------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Neon's **pooled** endpoint (`-pooler` in the hostname) | The running app (`TypeOrmModule.forRootAsync`)                                                |
| `DIRECT_URL`   | Neon's **direct** endpoint                             | Migrations only — `migration:run`, `migration:generate`, `migration:revert`, `migration:show` |

Both are built from one function, `buildDataSourceOptions(urls, { direct })`
in `src/database/data-source-options.ts` — the app calls it with
`direct: false`, the standalone migration CLI/runner call it with
`direct: true`. There's no other branching between the two paths, so they
can't silently drift apart.

**Branching:** create a Neon project, then a branch per purpose (e.g. a `dev`
branch for local work, separate from whatever the graded/CI branch is). Each
branch gets its own pooled + direct connection string pair from the Neon
console — copy both into `.env`. Branching is how you get an isolated,
disposable database for a feature or a CI run without touching the primary
branch's data or requiring a fresh `migration:run` history.

**Local Postgres instead of Neon** — a working fallback for everything except
branch-per-CI:

```bash
docker compose --profile dev up db
```

Then point both `DATABASE_URL` and `DIRECT_URL` at it (same value is fine —
there's no PgBouncer in front of a local container):

```
DATABASE_URL=postgres://gridline:gridline@localhost:5432/gridline
DIRECT_URL=postgres://gridline:gridline@localhost:5432/gridline
```

Swap `localhost` for the Compose service name `db` only when these values are
consumed _from inside another container_ (e.g. if you add a service-level
override) — `db:5432` doesn't resolve from the host.

**Migrations** are never auto-run by the app (`migrationsRun: false`,
`synchronize: false` — see the comment in `data-source-options.ts` for why).
Run them explicitly:

```bash
npm run migration:run      # applies pending migrations; safe to re-run
npm run migration:show     # lists applied/pending
npm run migration:revert   # rolls back the last migration
npm run migration:generate # diffs entities against the DB, writes a new migration
```

## Running locally

```bash
npm run start:dev          # watch mode, host-based
node dist/main.js          # after `npm run build` — proves compiled ESM resolves
docker compose --profile dev up   # full stack: local db + migrate + api + web + proxy
```

Without Docker's `proxy` (Caddy) in front, the API has no `/api` prefix —
`main.ts` deliberately never calls `setGlobalPrefix`, since Caddy strips that
segment before forwarding. Hit routes bare (e.g. `/health`) when running
`node dist/main.js` directly.

## API documentation

`/reference` serves a branded Scalar UI generated from the live `@ApiTags`/
`@ApiOkResponse` annotations plus prose sidecars — see AGENTS.md's "API
documentation" section for the full convention (why there's no
`@ApiOperation`, how the CSP nonce for Scalar's inline bootstrap script
works, why the CLI plugin is deliberately not used).

```bash
npm run docs:generate   # regenerates docs/openapi.yaml + per-tag split; fails naming any operationId missing prose or any tag not placed
npm run docs:check      # diffs a fresh regeneration against the committed docs/openapi.yaml
npm run docs:types      # docs/openapi.yaml -> docs/openapi.d.ts, for a typed frontend API client
```

The reference is laid out for a reader, not in the order Nest registered controllers: `src/docs/api-structure.ts` lists the
sections (Your data, Accounts and people, Plans and billing, Governance, Developers, System), the tags in each with a sentence of
description, and the order of the paths. A controller with a new `@ApiTags` value must be placed there, or `docs:generate` fails
and names the tag.

## Connecting an AI agent (MCP)

The API is also an MCP server, so an agent can list files, read data-quality reports, upload data, compare versions row by row
(`compare_version_rows`, `start_row_comparison`) and analyse a file without downloading it (`explore_file`, `ask_file`) for a
company. In the app, create an API key with the `mcp` scope plus what the agent should be allowed to do (`files:read`,
`files:write`, and for an admin `rules:write`, `audit:read`, `billing:read`; `notifications:read` for the inbox). The agent only sees the tools that
key may use, and never more than its creator may. Behind Caddy the URL is `/api/mcp`; directly it is `/mcp`.

```bash
claude mcp add --transport http gridline http://localhost:4000/mcp --header "Authorization: Bearer gl_live_…"
```

Any MCP client that supports Streamable HTTP and a bearer header works the same way. Uploads through MCP are limited to 8 MB;
bigger files go through `POST /files`. Revoking the key (or disabling its creator) cuts the agent off on its next call.

## Configuration

Every environment variable, where it comes from and what breaks without it:
[`docs/ENV_SECRETS_GUIDE.md`](./docs/ENV_SECRETS_GUIDE.md). Inside Docker the database URLs need a container-side
override (`.env` says `localhost`): see [`.env.docker.example`](./.env.docker.example).
Setting up Stripe from nothing, one value at a time: [`docs/STRIPE_SETUP.md`](./docs/STRIPE_SETUP.md). Running it on a server:
[`../DEPLOYMENT.md`](../DEPLOYMENT.md).
Public brand assets use a separate private S3 bucket behind CloudFront OAC; see
[`docs/CLOUDFRONT_ASSETS.md`](./docs/CLOUDFRONT_ASSETS.md). Customer spreadsheet objects are never exposed by that distribution.
Production requires the public HTTPS asset origin; development may omit it and render the text wordmark.

## Seed data

```bash
npm run build
npm run seed:demo     # the read-only demo company (idempotent) — needs the same STORAGE_* settings as the API
npm run seed:all      # demo + a plain fixture company you can sign in to (refuses to run in production)
```

The fixture company signs in with `admin@fixture.gridline.test` / `Fixture-Password-1!` (and two employees,
`ada@…` / `grace@…`, same password). **Demo mode:** `POST /auth/demo` signs anyone in as the demo company's admin without a
password; every write by that company is refused with a 403 that explains why (`DemoReadOnlyGuard`). The demo admin has no
password at all, so there is nothing to guess.

## How the pieces behave (the parts that are easy to get wrong)

- **A durable task queue, not an event bus.** Email and report-building are rows in `background_task`, enqueued inside the
  same transaction as the change that caused them (so a rolled-back change never sends anything), claimed with
  `FOR UPDATE SKIP LOCKED`, retried with backoff and marked `dead` after five attempts. There is no message broker and no
  in-process event emitter: a handful of jobs that must survive a restart is what this is for.
- **Plans are code, in one place.** `src/subscriptions/plan-catalog.ts` (`PLAN_CATALOG`) holds every number the brief
  specifies: seat caps, file quotas, prices, overage, request budgets, plus how many plain-language questions a period may ask
  (`questionsPerPeriod`: 20 / 300 / 3,000) and whether every new version may be cleaned automatically (`autoClean`: Basic and
  Premium). **Decision D2** ("Basic: 0 to 10 users") is read as
  _10 employees plus the admin_ (max $50/month). The other reading — 10 seats *including* the admin (max $45) — is the
  one-line change `basic.maxEmployees: 9`; nothing else needs touching, and `plan-catalog.spec.ts` will tell you which
  assertions encode the current reading.
- **Paid subscriptions are fulfilled by Stripe, not by a fake local switch.** Free activates locally; Basic and Premium return a
  hosted Checkout URL and become active only after a signed Stripe webhook confirms the provider state. Paid changes reset the
  cycle and invoice proration immediately. Basic synchronizes active-employee quantity through an ordered durable task; Premium
  reports every file-version usage event with that immutable event ID for retry-safe metering. Failed payment opens a seven-day
  grace period, then suspends access while leaving billing recovery available to admins. Run `npm run stripe:verify-catalog` during
  deployment to prove the configured prices, meter, portal and webhook match Gridline's assumptions.
- **Rate limits follow the plan.** 30 / 120 / 600 requests a minute per _company_ (Free / Basic / Premium), shared by its
  users and API keys, with `X-RateLimit-*` headers and a 429 that names the plan and the way up. Sign-in and email-sending
  routes have tighter per-address limits, and so does asking a file a question (10 a minute, because every answer is a model
  call). Counters are in memory: correct for one API instance.
- **API keys** (`gl_live_…`) are personal, shown once and stored hashed. A key acts as its creator _as they are now_ (role
  and status re-read every request), narrowed to its scopes (`files:read`, `files:write`, `billing:read`, and the opt-in `mcp`, `rules:write`,
  `audit:read`, `notifications:read`; the last three need an admin, or are personal to the creator). A route with no
  `@RequireScopes` is closed to keys, so identity, employees, plans, analytics, GraphQL and `/api-keys` itself can never be
  reached with one — a leaked key cannot create more access. Disabling a person revokes their keys.
- **Realtime** (Socket.IO, `io(url, { auth: { token } })`, same access token as REST): `file.status`, `quota.updated` and
  `audit.appended`, emitted only after the change commits. Restricted-file events reach only the people who may see the file.
  The server tracks the verified JWT expiry, warns once during its final minute, and disconnects at expiry. A client that obtains a
  replacement access token emits `auth.refresh` before then; only the same active user is accepted and room membership is rebuilt
  from the person's current role. API keys never authenticate sockets.
- **Comments and presence**: visible coworkers can discuss a file in a one-level thread, mention people who already have access,
  and watch a file for deduplicated presence and rate-limited typing indicators. Comment changes are pushed after commit; file
  access changes evict unauthorized watchers immediately. API keys may read comments with `files:read` but never write them.
- **Outgoing webhooks** let an admin subscribe an HTTPS receiver to report, rule, quota, invoice and upload events. Each endpoint
  gets a one-time `whsec_` secret encrypted at rest; deliveries sign `timestamp.body`, reject redirects and private-network DNS,
  and reuse the durable queue's five attempts and exponential backoff. HTTP 410 disables immediately, twenty consecutive
  terminal failures disable automatically, and a successful delivery resets the count. Employees and API keys cannot manage them.
  Delivery history is retained for 30 days and purged daily; endpoint configuration and encrypted secrets remain.
- **Notifications** (`GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read`, `GET
/notifications/unread-count`) are each person's own inbox — a session, or an API key holding the opt-in `notifications:read` scope, never another person's. They are written in the same
  transaction as the change that caused them (a rolled-back upload announces nothing) and pushed as `notification.created` after
  the commit. **Quota alerts** fire at 80% and 100% of the file quota, once per billing period each (a unique
  `(company, period, threshold)` row decides), to every admin and by email to the billing address.
- **Quality rules** (`/quality-rules`, admin writes, anyone reads) are checked against every upload's statistics when its report is
  built: `ruleResults` (passed / failed / skipped, each with a snapshot of the rule) and a 0–100 `qualityScore` on the report and on
  the `file.status` event. A rule about a column a file lacks is skipped, not failed. Editing a rule never rewrites an old report;
  `POST /files/:id/report/rebuild` (uploader or admin) re-checks against today's rules. Limits: Free 3, Basic 25, Premium unlimited
  rules, at most 10 `unique` rules; a downgrade over the target's limit is refused.
- **File versions** (`POST /files/:id/versions`, `GET /files/:id/versions`, `GET /files/:id/compare/:otherId`): each file has a
  `datasetId`, a `version` and `isLatest`. A new version is an ordinary upload (quota, idempotency, its own report) that inherits the
  file's visibility and grants; `GET /files` lists only the latest of each unless `?allVersions=true`. Deleting the latest promotes
  the previous one; version numbers are never reused. Comparing works from stored reports; a version that drops or retypes a column
  sends `dataset.schema_changed` to the uploader and admins (and as a webhook). Limits: Free 5, Basic 50, Premium unlimited versions
  per file. A version made by cleaning counts toward the limit but not toward the file quota.
- **Personal-data scan.** Profiling marks columns that look like emails, phone numbers, card numbers (Luhn), IBANs (mod 97), IP
  addresses, birth dates or secrets, by patterns and checksums over a bounded sample. Never an AI, and the report holds the kind
  of data and the column, never a value (`src/files/quality/sensitive.ts`). A file that is visible to the whole company and holds
  such a column notifies its uploader and the admins and publishes `file.sensitive_data_found`; the `no_sensitive_data` rule kind
  can fail it. A workbook with several sheets reports which sheet was profiled, and `POST /files/:id/report/rebuild` can choose
  another.
- **Clean** (`src/files/cleaning/`). `POST /files/:id/clean/preview` counts what a recipe of steps would do over the whole file;
  `POST /files/:id/clean` (202, `Idempotency-Key` supported) queues `apply_cleaning_recipe`, and the result is the **next version**
  (`derivedFromFileId` says which file it came from). The steps are pure functions over the parsed sheet (`engine.ts`) and a
  workbook stays a workbook (`sheet-writer.ts`). It is not an upload: no usage event and no file quota, but it counts toward the
  versions limit, appears in the audit log as `file.cleaned`, and gets its own report. `GET|PUT /datasets/:id/settings` hold the
  saved recipe, "clean every new version" (plans with `autoClean`) and the dataset's key columns. A cleaned version is never
  cleaned again.
- **Row-level comparison** (`src/files/diff/`). `GET|POST /files/:id/compare/:otherId/rows` and `…/rows.csv`: with key columns two
  versions are lined up row by row (added, removed, changed, unchanged, rows that cannot be matched), computed by the
  `build_version_diff` task and stored with the first 500 changes. With saved keys every new version is compared with the one
  before it automatically, with a `dataset.changed` notification and webhook. Both versions must be visible to the caller.
- **Explore and ask** (`src/files/explore/`). `POST /files/:id/explore` runs a validated query (filters, up to two group-bys, up to
  four measures) over every row of the file; parsed sheets are cached per process. `POST /files/:id/ask` has
  `AiProvider.planQuery` turn a sentence into that same query, shown only the question and each column's name and type; the server
  validates the plan with Zod and runs it itself, and the answer never goes back to the model. Counted per plan in `ask_event`;
  the query builder is free. The demo company's read-only session may run `explore` and the cleaning preview (they only read);
  asking, which is counted, is refused for it.
- **Storage.** Files live in a private S3 bucket (or any S3-compatible store through `AWS_ENDPOINT_URL`, or a local folder in
  development) behind one `StorageDriver` interface. A daily janitor removes objects that no file row points to (the leftovers of a
  crash between storing a file and committing its row).
- **GraphQL** (`POST /graphql`) is the read-only dashboard API. Admins can query the same analytics as REST; admins and
  employees can query only the files they can already see, then select uploader, report, versions, comments, comment count,
  and grants (grants are returned only to an admin or the uploader). Per-request DataLoaders batch relations, while depth 6,
  cost 1000, and `first <= 50` bound work before execution. API keys and mutations are intentionally absent. The committed
  contract is `src/graphql/schema.gql`; regenerate it with `npm run graphql:schema`.

## Testing

```bash
npm test          # unit — no database required
npm run test:int  # integration — needs a reachable DATABASE_URL (local db or Neon)
npm run lint       # oxlint
npm run docs:check # the committed OpenAPI file matches the code
```

The integration suites run against a real Postgres, because the access rules, the billing arithmetic and the task queue are
proven there. They **truncate every table in the database they use**, so point them at a throwaway database (a Neon branch
or the local container), run one suite at a time against a shared one (parallel runs trip over each other's data), and run
`npm run seed:all` again afterwards if you want the demo data back. Migrations must be applied first (`npm run migration:run`).
GitHub Actions runs lint, the type check, unit and integration tests for both apps (`../.github/workflows/project-3.yml`).

## Docker

```bash
docker compose --profile dev up      # with a local Postgres
docker compose up                    # without it — DATABASE_URL/DIRECT_URL must point at Neon
```

`migrate` runs once against `DIRECT_URL` and exits; `api` waits for it to
succeed before starting. Production adds `docker-compose.prod.yml` (ports 80 and 443, certificates kept between restarts) and a
`SITE_ADDRESS`: see [`../DEPLOYMENT.md`](../DEPLOYMENT.md). `proxy` (Caddy) is the only published port — it
fronts both `web` and `api` on one origin so the browser never needs CORS in
the deployed topology.
