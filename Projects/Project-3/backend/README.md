# Gridline API

Multi-tenant SaaS backend — NestJS 12 (ESM), TypeORM 1.x, Neon Postgres. See
[`../SCOPE.md`](../SCOPE.md) for the full design and grading rubric, and
[`AGENTS.md`](./AGENTS.md) for the coding conventions this codebase follows.
**New here? Start with [`docs/OVERVIEW.md`](./docs/OVERVIEW.md)** — what the app is, every feature and why it exists.

## Setup

```bash
npm install
cp .env.example .env
```

Every key in `.env` is validated at boot by `src/config/env.schema.ts`. A
missing required key exits the process non-zero before it starts listening,
naming the key. `.env.example` documents the graded default for each var,
with the offline-dev fallback commented beneath it.

## Database — Neon pooled vs. direct

Neon fronts every connection with PgBouncer in transaction-pooling mode,
which breaks DDL and prepared statements. That's why there are **two**
connection strings, not one:

| Var | Endpoint | Used by |
|---|---|---|
| `DATABASE_URL` | Neon's **pooled** endpoint (`-pooler` in the hostname) | The running app (`TypeOrmModule.forRootAsync`) |
| `DIRECT_URL` | Neon's **direct** endpoint | Migrations only — `migration:run`, `migration:generate`, `migration:revert`, `migration:show` |

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
consumed *from inside another container* (e.g. if you add a service-level
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
npm run docs:generate   # regenerates docs/openapi.yaml + per-tag split; fails naming any operationId missing prose
npm run docs:check      # diffs a fresh regeneration against the committed docs/openapi.yaml
npm run docs:types      # docs/openapi.yaml -> docs/openapi.d.ts, for a typed frontend API client
```

## Configuration

Every environment variable, where it comes from and what breaks without it:
[`docs/ENV_SECRETS_GUIDE.md`](./docs/ENV_SECRETS_GUIDE.md). Inside Docker the database URLs need a container-side
override (`.env` says `localhost`): see [`.env.docker.example`](./.env.docker.example).

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
  specifies: seat caps, file quotas, prices, overage, request budgets. **Decision D2** ("Basic: 0 to 10 users") is read as
  *10 employees plus the admin* (max $50/month). The other reading — 10 seats *including* the admin (max $45) — is the
  one-line change `basic.maxEmployees: 9`; nothing else needs touching, and `plan-catalog.spec.ts` will tell you which
  assertions encode the current reading.
- **Paid subscriptions are fulfilled by Stripe, not by a fake local switch.** Free activates locally; Basic and Premium return a
  hosted Checkout URL and become active only after a signed Stripe webhook confirms the provider state. Paid changes reset the
  cycle and invoice proration immediately. Basic synchronizes active-employee quantity through an ordered durable task; Premium
  reports every file-version usage event with that immutable event ID for retry-safe metering. Failed payment opens a seven-day
  grace period, then suspends access while leaving billing recovery available to admins. Run `npm run stripe:verify-catalog` during
  deployment to prove the configured prices, meter, portal and webhook match Gridline's assumptions.
- **Rate limits follow the plan.** 30 / 120 / 600 requests a minute per *company* (Free / Basic / Premium), shared by its
  users and API keys, with `X-RateLimit-*` headers and a 429 that names the plan and the way up. Sign-in and email-sending
  routes have tighter per-address limits. Counters are in memory: correct for one API instance.
- **API keys** (`gl_live_…`) are personal, shown once and stored hashed. A key acts as its creator *as they are now* (role
  and status re-read every request), narrowed to its scopes (`files:read`, `files:write`, `billing:read`). A route with no
  `@RequireScopes` is closed to keys, so identity, employees, plans, audit, analytics, GraphQL and `/api-keys` itself can
  never be reached with one — a leaked key cannot create more access. Disabling a person revokes their keys.
- **Realtime** (Socket.IO, `io(url, { auth: { token } })`, same access token as REST): `file.status`, `quota.updated` and
  `audit.appended`, emitted only after the change commits. Restricted-file events reach only the people who may see the file.
- **Notifications** (`GET /notifications`, `POST /notifications/read-all`, `POST /notifications/:id/read`, `GET
  /notifications/unread-count`) are each person's own inbox — session only, never another person's. They are written in the same
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
  sends `dataset.schema_changed` to the uploader and admins. Limits: Free 5, Basic 50, Premium unlimited versions per file.
- **GraphQL** (`POST /graphql`) is a read-only twin of `GET /analytics/usage` — admins only, no mutations, depth and cost
  limits, and a committed schema (`src/graphql/schema.gql`, regenerate with `npm run graphql:schema`).

## Testing

```bash
npm test          # unit — no database required
npm run test:int  # integration — needs a reachable DATABASE_URL (local db or Neon)
npm run lint       # oxlint
```

## Docker

```bash
docker compose --profile dev up      # with a local Postgres
docker compose up                    # without it — DATABASE_URL/DIRECT_URL must point at Neon
```

`migrate` runs once against `DIRECT_URL` and exits; `api` waits for it to
succeed before starting. `proxy` (Caddy) is the only published port — it
fronts both `web` and `api` on one origin so the browser never needs CORS in
the deployed topology.
