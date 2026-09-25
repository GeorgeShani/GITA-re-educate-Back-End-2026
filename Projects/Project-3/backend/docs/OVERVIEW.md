# Gridline — what it is, what it does, and why

Gridline is a **multi-tenant SaaS backend for uploading and understanding spreadsheets**. A company signs up, picks a
plan, invites its people, and they upload CSV/XLS/XLSX files. Each file gets an automatic **data-quality report**
(missing values, mixed types, duplicates, an optional plain-language summary written by an AI model), access can be
restricted to specific people, and the company is **billed by seats and usage**. This folder is the API; the Next.js
dashboard lives in `../frontend`.

Design and grading scope: [`../../SCOPE.md`](../../SCOPE.md). Coding rules: [`../AGENTS.md`](../AGENTS.md).
Settings: [`ENV_SECRETS_GUIDE.md`](./ENV_SECRETS_GUIDE.md).

## The stack, and why each piece

| Piece | Choice | Why |
|---|---|---|
| Framework | NestJS 12, ESM | Modules, DI and guards give one place for cross-cutting rules (auth, tenancy, throttling). |
| Database | Postgres (Neon in production), TypeORM 1.x | Real transactions and row locks are what billing and quotas need. |
| Validation | class-validator at the HTTP edge, Zod everywhere else | class-validator feeds the OpenAPI document; Zod guards data whose shape a database or third party controls. |
| API docs | OpenAPI generated from code + hand-written prose, rendered with Scalar at `/reference` | Docs cannot drift from the code (`npm run docs:check` fails on drift). |
| Files | S3 (or a local folder offline) behind a storage seam | Private bucket, short-lived download links. |
| Background work | A Postgres-backed task queue (not a message broker) | A handful of jobs (email, reports) that must survive a restart; enqueued in the same transaction as the change. |
| Email | MJML templates, SMTP or console | Console transport prints links, so no mail account is needed in development. |
| AI | Gemini behind a seam, or off | The metrics never depend on an AI account. |
| Realtime | Socket.IO | Live report status and quota meters without polling. |
| Extra read API | GraphQL (read-only) | One request for a whole analytics dashboard. |
| Telemetry | `@nestjs/observe`, behind a seam | Traces and business counters; a silent no-op without credentials. |

## Multi-tenancy, in one paragraph

A **company** is the tenant. Every tenant-owned row carries a `companyId`, every such query is built through one helper
(`TenantScope`), and the tenant comes from the signed-in user's row — never from the request. Another company's data is
not "forbidden", it is **404**: nothing discloses that it exists.

## Features

### 1. Accounts, sign-in and sessions
- **Register a company** (5 fields) → an activation email → the company and its first admin become active. Sign-in is
  blocked until then. *Why:* proves the address is real before anyone can spend money or store data.
- **Login, refresh, logout, password reset and change.** Access tokens live 15 minutes; refresh tokens are opaque, stored
  hashed and **rotated on every use** — presenting an already-used one revokes the whole family, because it means the token
  was copied. *Why:* a stolen refresh token stops working the moment the thief or the owner uses it.
- **The user is re-read from the database on every request.** Role, status and the company's status are never trusted from
  the token. *Why:* disabling, demoting or suspending someone takes effect on their very next request, without a revocation list.
- **Google sign-in and linked accounts.** Identity is `(provider, provider user id)` — **never the email**. An invitation link
  is itself the proof of identity, so someone can accept an invite with a Google account whose address does not match.
  *Why:* people use personal Google accounts for work invitations; matching on email would lock them out or, worse, hand
  an account to the wrong person.
- **Roles:** `admin` and `employee`. Every route is either public or declares who may call it; a test fails the build if not.

### 2. Plans and billing
| Plan | Employees | Files / period | Price | Requests / minute |
|---|---|---|---|---|
| Free | 0 (admin only) | 10 | $0 | 30 |
| Basic | up to 10 | 100 | $5 per employee per month, prorated by active days | 120 |
| Premium | unlimited | 1000 | $300 flat + $0.50 per file over 1000 | 600 |

- **Choosing and changing plans.** The first choice is mandatory (file routes answer 402 until then). Changing plan is a
  **new activation**: the old period is closed and invoiced for the days it ran, and a fresh period starts. A downgrade
  the company does not fit into (too many employees or files) is refused with the numbers that must come down.
- **Proration by the day.** An employee who joined ten days into a month pays for the days since, not a flat $5. Seat time
  comes from `seat_interval` rows opened on accept-invite and closed on removal, so disable-then-reactivate is billed correctly.
- **Invoices** are produced by the same calculator that shows the running bill, by a **daily rollover job**
  (`npm run billing:run-cycle`, also scheduled) that is idempotent — running it twice bills nothing twice.
- **Money is integer cents** everywhere. *Why:* no floating point in anything that is charged.
- **The plans are one constant** (`PLAN_CATALOG`), so a reading of the brief can be changed in one line.

### 3. People
- **Invite → accept** (password or Google). An invited person **holds a seat but is not billed** until they accept.
- **Remove** is a soft disable: access stops, the seat is freed, sessions, login methods, file grants and API keys are
  revoked and live sockets are closed — but what they uploaded and the audit trail stay with the company.
- **Reactivate** is a fresh invitation (their credentials were deleted). Seat caps are enforced under a row lock so two admins
  cannot both take the last seat.
- Employees see a names-only list of colleagues (`/companies/me/members`) — enough to pick who to share a file with, nothing else.

### 4. Files
- **Uploads are validated by their bytes**, not their name or declared type: a renamed `.exe` is rejected. CSV, XLS and XLSX only, 25 MB.
- **Quota per plan.** Free/Basic answer 402 past the limit (naming the plan, the count and the reset date); Premium accepts
  and bills the overage, with an `X-Gridline-Quota-Warning` header. Two uploads racing for the last slot are serialized.
- **Visibility.** A file is visible to the whole company or restricted to the uploader, chosen people and admins. One
  predicate decides it for every read; a hidden file is a 404, never a 403.
- **Idempotent retries.** Send an `Idempotency-Key` and a retried upload (or plan change) replays the first answer instead of
  running twice. A janitor deletes the records once they can no longer be replayed.
- **Cursor pagination** for listing (no duplicates or gaps, stable under new uploads), with sort and filters.
- **Downloads** are 5-minute signed links, minted only after the access check.

### 5. Data-quality reports and previews
- Every upload queues a report: row/column counts, per-column null %, inferred type and inconsistency, duplicate rows, numeric
  means; capped by a row budget so a big file cannot exhaust memory. A first-50-rows **preview** is stored at the same time,
  so no request ever parses an untrusted file.
- An **AI narrative** (summary + recommendations) is added when a provider is configured. It only ever sees aggregates,
  never cell values, and can never fail a report.
- Transient failures (storage, database) are retried by the queue; permanent ones (a corrupt file) end as `failed` with a reason.
  *Why:* users get useful output even without an AI account, and one bad file never blocks the queue.

### 5a. Data-quality rules
- A company writes **rules** once — "the `email` column is at most 5% empty", "`amount` is never negative", "no value in `id` repeats",
  "the file has no duplicate rows", "a `phone` column exists" — and **every upload is checked against them**. The report shows a
  result per rule (passed / failed / skipped) and a **quality score** from 0 to 100 (an *error* rule counts double a *warning*).
  A file that fails an *error* rule notifies the uploader and the admins.
- Rules look at a file's statistics, never its rows, and a rule about a column a file does not have is **skipped**, not failed, so
  one company-wide rule set can cover very different files. Each report keeps the rules **as they were** when it was built;
  after changing a rule, an uploader or admin rebuilds a report to check the file against today's rules.
- Limits follow the plan (Free 3 rules, Basic 25, Premium unlimited; at most 10 "unique" rules). *Why:* the reports stop being
  just descriptive — a company can say what "good data" means for it and be told, on upload, when a file is not.

### 6. Audit log and usage analytics
- **Every state-changing action writes an audit entry in the same transaction as the change**, from a closed list of actions
  (a test proves each is really written). The table is append-only — the database itself refuses updates and deletes.
  `GET /audit` is admin-only and cursor-paginated. *Why:* accountability that cannot be quietly rewritten.
- **`GET /analytics/usage`**: uploads per day, per employee, storage, the quota burn-down against an even pace, and plan history.

### 7. Personal API keys
- A person mints a key (`gl_live_…`), shown **once** and stored hashed, to upload from a script. Scopes: `files:read`,
  `files:write`, `billing:read` (admins only).
- A key **acts as its creator as they are right now**; it is never more than their role and its scopes. A route that does not
  opt in with `@RequireScopes` is closed to keys, so a leaked key cannot read identity, manage people, change plans, mint more
  keys or reach GraphQL. Disabling the person kills their keys.

### 8. Rate limiting that follows the plan
- The request budget is **per company** (users and keys share it) at the plan's limit, with `X-RateLimit-*` headers and a 429
  that names the plan and the way up. Sign-in and email-sending routes have tighter per-address limits. A plan change applies
  on the very next request, and the plan routes keep their own small budget so a throttled company can still upgrade.
  *Why:* the infrastructure limit is the product limit, not a generic throttle bolted on beside the plans.

### 9. Demo mode
- `npm run seed:demo` builds a populated, **read-only** company (Basic plan, four people, six files with real reports, an
  invoice, an audit trail). `POST /auth/demo` signs anyone in as its admin with no password; every write is refused with a
  message that explains why. *Why:* a reviewer can explore the product without registering.

### 10. Realtime
- Socket.IO pushes `file.status` (queued → profiling → ready), `quota.updated`, `audit.appended` and `notification.created`.
  Events go out **only after the change commits**, and a restricted file's events reach only the people who may see it —
  decided at emit time.

### 10a. Notifications and quota alerts
- Every person has an **inbox** (`GET /notifications`, unread count, mark one or all as read). It fills with: a report that is
  ready or failed for good (to the uploader), a file shared with you, an invoice to pay (to admins), and **quota alerts**.
- **Quota alerts:** when a company passes 80% and again at 100% of its file quota, every admin gets an inbox entry and the billing
  address gets an email — once per billing period each. At 100% the message says what happens next: Free and Basic stop accepting
  uploads (and it names the plan that raises the limit), Premium keeps going and bills overage. *Why:* the company hears about
  the wall before it hits it, and the message doubles as the upgrade prompt.
- A notification is written **in the same transaction as the thing that caused it**, so a rolled-back upload announces nothing,
  and it is pushed live only after that commit. Read entries are removed after 90 days.

### 11. GraphQL (read-only)
- `POST /graphql` returns the same analytics as REST, from the same service; admins only, no mutations, depth and cost limits,
  and a committed schema (`src/graphql/schema.gql`).

### 12. Operations
- **Telemetry:** requests are tagged with the tenant; counters for uploads, quota hits, plan changes and invoices (plan label only).
  Tokens and one-time links are redacted from logs.
- **Docs:** interactive reference at `/reference`, generated from the code; `docs/openapi.d.ts` gives the frontend typed calls.
- **Seeds, health check, structured logs with a correlation id** that ties a request's log lines to its audit entries and error response.

## Common commands

```bash
npm run build && npm run lint && npm test && npm run test:int && npm run docs:check   # the gate
npm run dev                # API on :4000, Scalar reference at :4000/reference
npm run migration:run      # apply migrations (never automatic)
npm run billing:run-cycle  # close finished billing periods
npm run seed:demo          # the read-only demo company
npm run seed:all           # demo + a writable fixture company (not in production)
npm run graphql:schema     # regenerate src/graphql/schema.gql
npm run docs:generate      # regenerate the OpenAPI documents
```

## How it is tested

- **Unit tests** (`npm test`, no database): billing maths, periods, the metrics engine, codecs, guards, validators.
- **Integration tests** (`npm run test:int`, real Postgres): most boot the **real application** and drive it over HTTP with
  supertest, replacing only the edges (clock, mail, storage, Google, AI, telemetry). Plus sockets over a real connection,
  the EXPLAIN plan of the file-list query, and one spec that walks the graded path from `SCOPE.md` end to end.
- Behaviour that matters (locks, ACLs, guards) was **mutation-checked**: break the code on purpose, confirm a test fails.
- No type assertions or `any` anywhere; oxlint enforces it.

## Known limitations (on purpose, and written down)

- Rate-limit counters are in memory: right for one API instance; scaling out needs a shared store.
- A live socket is authenticated when it connects; an expired 15-minute token does not close it (removal of a person does).
- A crash between storing a file and committing its row can leave an orphaned object; there is no sweeper yet.
- Legacy `.xls` files are accepted and stored but not profiled (the available parsers carry security advisories).
- No payment processor: invoices are finalized, not collected, and "suspended" is set by an operator.
- No CI workflow for now; the gate is run by hand.
