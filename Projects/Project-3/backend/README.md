# Gridline API

Multi-tenant SaaS backend — NestJS 12 (ESM), TypeORM 1.x, Neon Postgres. See
[`../SCOPE.md`](../SCOPE.md) for the full design and grading rubric, and
[`AGENTS.md`](./AGENTS.md) for the coding conventions this codebase follows.

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
segment before forwarding. Hit routes bare (`/health`, `/_probe`) when running
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
