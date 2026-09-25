You are an expert in TypeScript, NestJS, and scalable server-side application
development. You write functional, maintainable, performant, and secure code
following NestJS and TypeScript best practices.

This is the **Gridline API** — a multi-tenant SaaS backend. The authoritative
scope lives in [`../SCOPE.md`](../SCOPE.md); read it before adding a feature.

---

## This project's hard constraints

These are not style preferences. Each one has already cost something, or is
recorded as a trap in the implementation plan.

- **ESM.** `"type": "module"`, `module: nodenext`. Every relative import needs an
  explicit `.js` extension, even from a `.ts` file. `import { X } from './x.js'`.
- **`useDefineForClassFields: false`** in `tsconfig.json`. Never set it true and
  never remove it. At target ES2022+ it defaults to true, which makes
  `name: string;` on a TypeORM entity emit a real class field; every
  `new Entity()` then owns all keys as `undefined`, so partial `save()` starts
  nulling columns. Both tsc and oxc agree, so nothing errors — you just get
  wrong writes.
- **Imports: `./…` for the same folder or below, `#/…` for anything above or elsewhere.**
  `#/*` is a native Node *subpath import* (package.json `"imports"`), **not** a
  `tsconfig` `paths` alias — those compile and pass in Vitest, then fail at
  `node dist/main.js` because ESM has no runtime path mapping. Write
  `import { X } from '#/core/clock/clock.js'` (path from `src/`, explicit `.js`);
  never `../../core/...`. Test-only helpers use `#test/*` (→ `test/`, no
  runtime mapping — it must never appear in `src/` non-spec code). How it
  resolves: the `gridline-source` condition maps to `src/`/`test/` (set by
  `customConditions` in `tsconfig.json` and by `resolve`/`ssr.resolve` in both
  Vitest configs); the `default` condition maps `#/*` to `dist/*`, which is what
  Node, the migration CLI and the Docker runtime image use. **Never remove
  either Vitest setting**: without the SSR one, `#/*` silently falls back to
  stale `dist/` and every class exists twice; `src/alias.spec.ts` guards this.
  Requires a Node that accepts `#/`-prefixed specifiers (verified on Node 24, the
  Docker image version).
- **No `verbatimModuleSyntax`.** With `emitDecoratorMetadata`, a constructor
  parameter typed via `import type` emits no `design:paramtypes` entry, and DI
  then fails at runtime with "can't resolve dependency at index N".
- **No `setGlobalPrefix`.** Caddy's `handle_path /api/*` strips that segment
  before forwarding, so routes are declared unprefixed. Adding a prefix makes
  the public path `/api/api/...`.
- **Never break the canary.** `src/core/audit/audit.metadata.spec.ts` asserts that
  decorator metadata is still emitted. If it fails, fix the compiler
  configuration — do not debug the DI graph or TypeORM column types.

## Configuration

- Read config from the **`APP_CONFIG`** token, which yields a frozen, fully typed
  `AppConfig`. **Never inject `ConfigService`** and never read `process.env`
  outside `src/config/`.
- Add a new key to `src/config/env.schema.ts` and to `.env.example` in the same
  change. Decide its tier: required now (boot fails without it) or required by
  its phase (optional here; the module that needs it asserts its own
  requirement when first used).
- Every optional key must tolerate `''`, because `.env.example` ships keys
  present but unset and dotenv yields the empty string.
- Defaults belong in the schema, never at read sites.

## Request context

- Inject **`RequestContextService`**, never `ClsService` directly. Project-2
  ended up with a `private correlationId()` helper copy-pasted into ~20 files;
  that is the thing this exists to prevent.
- Add a new context field to the `ClsStore` augmentation in
  `src/core/context/cls-store.ts` so it is typed, not a magic string.
- Non-HTTP entry points (scheduled jobs, the background task runner) must
  re-establish context with `runWith(correlationId, …)` so their logs correlate
  with the request that queued the work.

## Logging

- Inject nestjs-pino's `PinoLogger`; do not use Nest's `Logger`. One structured
  stream, correlated by `correlationId`.
- Anything sensitive goes in `src/core/redaction.ts`, which is the single source
  for both pino's `redact.paths` and Observe's `redaction.keys`.
- `pino-pretty` is a devDependency and is absent from the Docker runtime stage.
  Gate any transport on `config.isProduction`, never on a separate flag.

## NestJS

- One feature module per domain area, owning its own entities, DTOs, service and
  controller. Cross-cutting infrastructure goes in `src/core/`; shared HTTP
  building blocks in `src/common/`.
- Keep controllers thin: parse the request, delegate, return. No business logic.
- Business logic lives in `@Injectable()` services, with constructor injection
  into `private readonly` fields.
- Register providers in the module that owns them; export only what other
  modules actually consume.
- Global pipes, filters, guards and interceptors are registered as
  `APP_PIPE`/`APP_FILTER`/`APP_GUARD`/`APP_INTERCEPTOR` providers in a module —
  **not** via `app.useGlobalX()` in `main.ts`, which gets no DI.

## Validation

**class-validator owns the HTTP boundary. Zod owns every other trust boundary.**
This split is deliberate — class-validator is what produces the OpenAPI
document.

- One DTO class per request body/query/param, with `class-validator` decorators
  and `@ApiProperty`/`@ApiPropertyOptional`.
- The global `ValidationPipe` runs `whitelist`, `forbidNonWhitelisted` and
  `transform`. It deliberately does **not** enable `enableImplicitConversion`,
  so numeric and boolean query params need an explicit `@Type(() => Number)`.
- Use Zod for: environment config, `jsonb` columns read back from Postgres,
  LLM responses, and parsed spreadsheet shapes. Anything whose shape the
  database or a third party controls.

## Persistence *(from Phase 2)*

- Entities extend the abstract `BaseEntity` (uuid + timestamps).
- Add every new entity to the **`ENTITIES`** array in
  `src/database/entities.ts`. `autoLoadEntities` is off — the standalone
  migration CLI has no Nest container, so the explicit array is the single
  source of truth. A drift spec enforces this.
- `synchronize` and `migrationsRun` stay **false**. Schema changes are
  migrations, always.
- Migrations run against `DIRECT_URL`, never `DATABASE_URL` — PgBouncer's
  transaction pooling breaks DDL.
- Every tenant-scoped table gets a composite index **leading with `companyId`**,
  and every tenant-scoped query goes through `TenantScope`. Never hand-roll a
  `where: { companyId }`.
- Add the new index to the checklist below and to the `pg_indexes` assertion
  spec in the same change.

## Auth & RBAC *(from Phase 2 of the feature plan)*

- **Auth is opt-out.** `AuthGuard` (global `APP_GUARD`, in `AuthModule`) requires
  a valid access token on every route unless it is `@Public()`, then
  `RolesGuard` narrows by `@Roles(...)`. Order matters and is the provider order
  in `AuthModule`. A new route is secure by default.
- **Every route is `@Public()` XOR carries `@Roles(...)`** — never neither.
  "Any signed-in user" is spelled out as `@Roles('admin', 'employee')`, so intent
  is explicit and `route-audit.spec.ts` can enforce it.
- **Identity is re-read from the database on every request**
  (`AuthenticationService.authenticate`). Role, user status and company status
  come from that row, never from the JWT, so a disable, demotion or suspension
  takes effect on the next request. Never put a role in the token. The JWT
  carries only `sub`, is pinned to HS256, and its claims are Zod-parsed.
- `@CurrentUser()` / `@CurrentUser('userId')` reads `request.user` (typed
  `keyof AuthenticatedUser`). Tenant, actor and role are also in request context
  (`RequestContextService`), set once by the guard; services read them there.
- **Never take a tenant id from the URL or body.** `PATCH /companies/me` and
  every later tenant route derive the company from context; DTOs reject an
  unknown `companyId`/`id` field outright (`forbidNonWhitelisted`).
- **Secrets at rest.** Passwords: scrypt (`PasswordHasher`, self-describing
  `scrypt$N$r$p$salt$hash`, cost bounded on verify). Opaque tokens (activation,
  invite, reset, refresh): 32 random bytes, stored as SHA-256 only
  (`TokenFactory`). Neither the plaintext nor a reversible form is ever stored.
- **Single-use tokens** go through `AuthTokenService.issue/consume`. `consume` is
  one `UPDATE … WHERE consumedAt IS NULL AND expiresAt > now RETURNING`, so two
  concurrent uses cannot both win. Issuing supersedes earlier unconsumed tokens
  of that type, so only the newest link works.
- **Refresh tokens rotate** and share a `familyId`. Presenting a spent token
  revokes the whole family; the revocation must *commit*, so the transaction
  returns an outcome and the 401 is thrown after it. Password change/reset revoke
  every family for the user.
- **Email-flow endpoints never reveal whether an address exists** (resend
  activation, forgot password): same answer, same status, work only if real.
  Login answers a wrong password and an unknown email identically and burns one
  scrypt either way (`verifyDummy`).
- A password login email is **globally unique** (`lower(email)` partial unique
  index on password identities); `User.email` is only unique per company. One
  login email = one account; the same person needs a different email per company.
- `JWT_REFRESH_SECRET` is required by the env schema but currently unused:
  refresh tokens are opaque and hashed, not JWTs. Kept so `.env` files stay valid.
- `@RequireScopes(...)` is the API-key analogue of `@Roles`, enforced by `ScopesGuard`
  (Phase 10). A key's effective permission is `(creator's live role) ∩ (key's
  scopes)` — never wider than either. See *Personal API keys* below.
- `@IdempotencyKey()` reads and validates the `Idempotency-Key` header. Returns
  `undefined` when absent; a route that requires one checks for that itself.
- **`route-audit.spec.ts` is the enforcement mechanism, not code review.**
  It discovers controllers by walking `AppModule`'s import graph, so there is
  no list to maintain: a controller in any module reachable from `AppModule`
  is audited automatically, and every route on it must satisfy the checks
  above or the build fails. A module not imported anywhere isn't a route.
- Integration specs drive HTTP through `test/support/app-harness.ts`, which boots
  the real `AppModule` and fakes only the clock and the mail transport
  (`registerAndActivate()`, `login()`, `seedEmployee()`, `drainTasks()`,
  `mail.latestTokenTo()`). Time-dependent behaviour (token expiry) is tested by
  advancing `h.clock`, never by sleeping.

## Billing & subscriptions *(from Phase 3 of the feature plan)*

- **Money is integer cents, never floats.** A prorated amount is
  `unit × days ÷ periodDays` through `divRound` (round half-up in integer
  arithmetic). `billing/calculator.ts` and `billing/period.ts` are pure — no Nest,
  no database, no clock — and are the most heavily tested files in the repo.
- **Periods are half-open `[start, end)`, both UTC midnights**, so proration is a
  whole number of days. The anchor is a day of the month, clamped **per month**
  (anchor 31: Jan 31 → Feb 28 → Mar 31, never drifting to the 28th). Billing is
  at day granularity: the **switch day belongs entirely to the incoming plan**.
- **A plan change is a new activation (D6):** close and invoice the outgoing
  period for the days it ran, then open a fresh period anchored to the switch day.
  Only the *outgoing* plan is ever prorated. Leaving Premium with more files than
  the target allows is refused, so a plan-change invoice can never carry overage.
- **Seat time comes from `seat_interval`, not `User.activatedAt/disabledAt`.**
  Those two columns hold one interval; a disable-then-reactivate would overwrite
  the first stretch and under-bill it. Employee lifecycle (accept invite, disable)
  opens and closes `seat_interval` rows; an `invited` user has none (holds a seat,
  bills $0 — D4). Phase 4 writes them; Phase 3 specs seed them directly.
- **Every writer of subscription state takes `SubscriptionsService.lockForUpdate`
  first** (plan change, employee invites, the rollover job), so they serialise per
  company. The plan-change UPDATE is also guarded by `version` — defence in depth
  behind the lock. **Call `InvoicingService.rollForward` before assuming the current
  period is current**, or days between a period ending and the daily job running
  are silently dropped from billing.
- `Invoice.lineItems` is `jsonb`: read it only through `parseLineItems` (Zod).
  `UNIQUE (companyId, periodStart)` is what makes rollover idempotent.
- `UsageEvent.fileId` is a real FK to `file_asset` (Phase 6); files are only soft-deleted, so events never dangle.
- **Global guards live in `AccessControlModule`, in order:** `AuthGuard` → `PlanThrottlerGuard` →
  `DemoReadOnlyGuard` → `ScopesGuard` → `RolesGuard` → `RequireSubscriptionGuard`. Each reads what the one before
  produced. `@RequiresSubscription()` (402 with no plan) goes on `employees/` and
  `files/`; `@AllowWhenSuspended()` marks the few routes (billing reads) a
  suspended company may still reach. Nothing suspends a company yet — there is no
  payment integration to fail — so suspension is set by an operator or a seed.
- A shared Postgres enum used by several columns (`subscription_plan`) is emitted
  by `migration:generate` once per column, which fails on the second `CREATE TYPE`.
  Hand-edit the migration to create and drop it once.

## Employees *(from Phase 4 of the feature plan)*

- **Seat cap = `invited` + `active` employees** (an invitation holds a seat, D4).
  Every operation that adds one — invite, reactivate — runs inside a transaction
  that first takes `SubscriptionsService.lockForUpdate`, counts with
  `employeeSeatsHeld`, and asks `seatCapProblem`. The lock is what stops two admins
  taking the last seat; `employees.integration.spec.ts` proves it by holding the
  row lock in an open transaction and asserting the invite *blocks* (racing two
  HTTP requests rarely overlaps enough to prove anything).
- **Employee lifecycle owns `seat_interval`.** Accepting an invite (any path —
  Phase 5's Google flow too) opens a row at that instant; disabling closes the open
  row. That is the only source of billable seat time. Anything that turns an
  employee `active` or `disabled` must open/close it.
- **"Delete" is a soft-disable (D7)** and does five things in one transaction: status
  `disabled`, close the seat interval, delete the login identities, revoke every
  refresh family, spend outstanding auth tokens. Later phases added file grants (6) and
  API keys (10: revoked, and counted in the `employee.disabled` audit metadata). Their uploads
  stay with the company.
- **Reactivate = a fresh invitation.** Identities were deleted on removal, so the
  person becomes `invited`, holds a seat again (cap re-checked) and sets a password
  on accept. `disabledAt` clears on accept.
- **The invite token is the proof of identity.** `accept-invite` compares no emails;
  it creates the password identity with `emailVerified: true`. Because a password
  login email is globally unique, inviting an address that already has a password
  account is refused up front (409) rather than dead-ending at accept.
- **`GET /companies/me/members` returns `{ id, fullName }` and nothing else**, for any
  signed-in user, active people only (D1). `MemberDto` is the projection; the spec
  asserts the exact key set — adding a field widens what every employee can learn.
- A person in another company is a **404**, never a 403 — existence is not disclosed.
- Class-level `@Roles(...)`/`@Public()` count for `route-audit.spec.ts` exactly as
  they do for the guards (route value wins, else the controller's).

## Google sign-in & linked accounts *(from Phase 5 of the feature plan)*

- **Email is not the key.** Sign-in looks up `(provider, providerUserId)`; the email a
  provider reports is an attribute of the identity and may differ from `User.email`
  forever. `auth/oauth/oauth-resolution.ts` is SCOPE's identity table as one pure
  function (unit-tested row by row) — change a rule there, not in the service.
- **The seam is `OAuthProvider`** (`authorizationUrl`, `exchangeCode` → `{ providerUserId,
  email, emailVerified, name }`). The `GOOGLE_OAUTH` token is `null` when the `GOOGLE_*`
  variables are unset (routes answer 503, password auth untouched); the harness
  replaces it with `FakeGoogleOAuthProvider`. The real provider is plain `fetch`: code
  exchange with the client secret, then the userinfo endpoint — back-channel to Google,
  no ID-token signature to verify.
- **The invite token is the proof of identity.** `intent: invite` carries the token's
  *hash* in the signed state; the callback consumes it and binds whatever Google
  account came back with no email comparison. Accepting an invite this way does
  everything `POST /auth/accept-invite` does — activates, sets `activatedAt`, **opens the
  `seat_interval`**, audits `employee.accepted_invite`. Any new way to accept an invite
  must do the same.
- **Auto-link by email is the narrow, dangerous path**: only for an *unknown* identity,
  a provider-**verified**, non-relay address, matching **exactly one** *active* user's
  contact address (an active user's address was proved by an emailed link). Unverified,
  relay, ambiguous (two companies) or inactive-company matches never link.
  `relay-address.ts` lists the relay domains; a relay address is never a contact
  address, never a discovery key, never mailed.
- **State and registration tokens are signed JWTs with their own derived key and
  audience** (`OAuthStateService`) — neither can be replayed as the other or as an
  access token. `iat` comes from the injected clock.
- **Login CSRF is closed by a cookie.** The state carries a nonce; `/oauth/google/url`
  and `/identities/google/link` also set it in an httpOnly `gl_oauth_nonce` cookie
  (`Path=/`, because Caddy strips `/api` — a narrower path is never sent back). The
  callback needs the two to agree. A server-side caller of those two routes must forward
  `Set-Cookie` to the browser.
- **Tokens never appear in a URL.** The callback always *redirects* (never JSON — a person
  is looking at it): `/session/oauth-complete?code=` (a 60-second single-use
  `oauth_exchange` AuthToken, traded at `POST /auth/oauth/exchange`, re-checking the
  account), `?error=<code>`, `/register?oauthRegistration=` (signed profile, no session),
  or `/settings/linked-accounts?linked=google`. Google appends `scope`, `authuser`…, so
  the callback's query is Zod-parsed loosely, not a class-validator DTO (which would 400).
- **Registration with Google** is `POST /auth/oauth/register-company` (a separate route
  from the password one so each contract is exact). A verified, non-relay address is the
  contact address: company + admin are `active` at once, no activation email, a session is
  returned. Otherwise `email` is required and it is a password registration minus the
  password. The form may not substitute a different address for a vouched-for one. A
  Google-only account has no password (forgot-password finds nothing).
- **One identity per provider per user** (`uq_auth_identity_user_provider`). Unlinking
  locks the user's identity rows and refuses the last one (409) so two concurrent unlinks
  of different identities cannot together remove them all; the spec proves it by locking
  the row that is *not* being deleted (locking the target would block regardless).
- `route-audit.spec.ts` lets a `@Redirect()` handler declare `@ApiResponse({ status: 302 })`
  in place of a typed body.

## Files *(from Phase 6 of the feature plan)*

- **Type is decided from bytes, never names** (`files/validation/sniff-spreadsheet.ts`;
  `file-type` 22.1.1 verified: xlsx → `xlsx`, OLE → `cfb`, CSV → `undefined`, `MZ` →
  `exe`). xlsx = ZIP with spreadsheet content types; **xls = OLE2 container that holds a
  `Workbook`/`Book` stream** (`validation/cfb.ts` parses the directory — Word `.doc`
  and `.msi` are OLE too); CSV = `file-type` finds *nothing* + valid UTF-8, no NUL/control
  characters, first rows parse. Empty is rejected. The stored `mimeType` is the detected
  one. Fixtures are built in `test/support/spreadsheet-fixtures.ts` (real ZIP/OLE
  builders), not committed binaries.
- **`FileVisibility`** (`files/file-visibility.ts`) is THE access rule — every read of
  `file_asset` goes `TenantScope.forCompany` → `applyFileVisibility`. An invisible file is
  **404, never 403**; someone who can see a file but isn't uploader/admin gets 403 on
  PATCH/DELETE. Phase 8's report/preview routes must use it too. Grantees are
  *only* revealed (`grantedUserIds`) to uploader/admin and only on single-file responses.
- **Upload order** (`FilesService.upload`): validate → pre-check quota (no lock; skipped if
  the stored period has ended) → `storage.put` → ONE transaction holding
  `lockForUpdate` (rollForward, real quota decision, file + grants + one `UsageEvent` +
  `build_data_quality_report` task + audit) → any failure deletes the object. A rejected
  or failed upload consumes no quota. A crash between `put` and commit can orphan an
  object (no sweeper yet). Deleting a file soft-deletes the row, removes the object after
  commit, and does **not** refund quota.
- **Storage seam** (`core/storage`): `StorageDriver` (`put/get/delete/presignedGetUrl`);
  `S3StorageDriver` default, `LocalStorageDriver` (dev/test; signed `GET /storage/local`,
  HMAC over key+exp+name, hidden from OpenAPI, 404 unless the local driver is active).
  Missing AWS vars → `UnconfiguredStorageDriver` (boot succeeds, first use is a 503 naming
  what to set). Keys are server-generated (`companies/<id>/files/<fileId>`). The harness
  swaps in a temp-dir `LocalStorageDriver` (`h.storage` — spy on it to inject failures).
- **Idempotency** (`core/idempotency`): `@UseInterceptors(IdempotencyInterceptor)` (list it
  *after* `FileInterceptor`). Insert-first claim (`UNIQUE (companyId, key)`), stores status,
  body and `X-Gridline-*` headers; same key + different route/caller/body/file bytes →
  422; still running → 409; failed requests are forgotten; claims older than 10 min are
  reclaimed, records older than 24 h expire. On `POST /files` and `PATCH /subscriptions/me`.
  No janitor deletes old rows yet (Phase 14).
- **Cursor lists**: `CursorPageOf(ItemDto)` mixin (like `OffsetPageOf`), `applyCursor(qb,
  alias, cursor, 'ASC'|'DESC')`. `GET /files` sorts by `createdAt` only (a cursor needs an
  ordering the index covers), default newest-first. **`createdAt`/`updatedAt` are
  `timestamptz(3)` on `BaseEntity`**: Postgres `now()` is µs but a cursor is a JS Date, and
  the lost digits made every page repeat the previous page's last row.
- **Multer decodes `filename` as Latin-1**; `decodeMultipartName` repairs UTF-8 names.
  `tsconfig` `types` includes `multer` for `Express.Multer.File` / `req.file`.
- **Tests never rely on racing.** Quota serialisation and the 409-in-progress case hold the
  subscription row lock in an open transaction and assert the request *waits*.
- Adding a task type worked as documented: enum migration + handler registered in
  `TaskRunnerModule` (which now imports `FilesModule`). `build_data_quality_report` is implemented
  in Phase 8 (see below).

## Billing endpoints & the rollover *(from Phase 7 of the feature plan)*

- **`GET /billing/current|invoices|invoices/:id`** are admin-only, `@RequiresSubscription()` and
  `@AllowWhenSuspended()` (a suspended company reads what it owes and nothing else).
  `BillingService.currentStatement` runs the SAME calculator as invoicing — there is no second
  implementation. It is a pure READ: while the stored period lags (daily job not yet run) it
  prices `effectivePeriod(anchor, stored, now)` and writes nothing. Open seat intervals project to
  the period's end ("what the invoice will be if nothing changes").
- **The rollover is `BillingCycleService.runCycle(now)`** (`billing/cycle/`, its own module because
  it needs both `BillingModule` and `SubscriptionsModule`). Per due subscription: own transaction →
  `lockForUpdate` → re-check under the lock → `InvoicingService.rollForward`. Idempotent and safe
  from two instances (lock + `UNIQUE (companyId, periodStart)` backstop); one company failing is
  logged and counted, never stops the others. Triggered by `@Cron('5 0 * * *', UTC)`
  (`BillingCycleScheduler`, inert under test) and by `npm run billing:run-cycle`
  (`dist/billing/cycle/run-cycle.js`: a standalone application context with no HTTP, no task
  runner, no schedule; it QUEUES invoice emails, the API's runner sends them; exit code 1 if any
  company failed).
- **Every invoice is announced from the one place they are created** (`InvoicingService.closePeriod`
  → `announce`): an audit entry `billing.invoice_finalized` (actor null when no request), and — only
  when the total is > $0 — a `send_email` `invoice_finalized` to `Company.billingEmail`, in the same
  transaction as the invoice. So the rollover, a plan change, and an upload that rolls the period
  forward all behave alike.
- `formatCents` (`invoicing.service.ts`) is integer maths only. `UNIQUE (companyId, periodStart)`
  is the tenant index for invoice listing too.

## Data-quality reports & preview *(from Phase 8 of the feature plan)*

- **A report exists from the moment the file does**: `FilesService.upload` inserts a `queued`
  `data_quality_report` row in the upload transaction, and the same transaction queues
  `build_data_quality_report`. `GET /files/:id/report|preview` go through
  `FilesService.requireVisible` (the ONE visibility rule) — 404 for an invisible file.
- **The worker** (`BuildDataQualityReportHandler`) takes its scope from the task payload
  (`fileId` + `companyId`, both used in the query) and skips a deleted file. Outcomes:
  transient error (storage/DB) → report `failed` ("will be retried") and the error is RETHROWN so
  the queue retries with backoff (the retry flips it to `profiling` → `ready`; if retries run out it
  honestly stays `failed`); permanent (`UnreadableFileError`: corrupt/oversized/unclosed quote) →
  `failed` with the reason and the task SUCCEEDS (retrying the same bytes is pointless);
  `UnsupportedFormatError` (legacy `.xls`) → `unsupported`. A `ready`/`unsupported` report is never
  redone.
- **Reader** (`files/parsing/spreadsheet-reader.ts`): CSV via `csv-parse/sync` (delimiter sniffed, BOM,
  `relax_quotes`), XLSX via exceljs **`workbook.xlsx.load`** — NOT the streaming `WorkbookReader`,
  which proved order-dependent and fails on files exceljs wrote itself. `zip-guard.ts` reads the ZIP
  central directory first and refuses > 200 MB inflated (zip bomb). **`.xls` is deliberately not
  profiled** (the only parsers carry a history of memory-safety/ReDoS advisories); the file is stored,
  listed and downloadable. Cells are normalised through Zod schemas (`normaliseExcelCell`).
- **Metrics** (`files/quality/metrics.ts`) are a pure streaming `MetricsAccumulator`: row/column counts,
  per-column null %, inferred type (integer+decimal are one numeric family), `inconsistent` +
  `inconsistentPercent`, numeric min/max/mean, duplicate rows (length-prefixed SHA-1 fingerprints),
  empty and ragged rows, header issues. Budget: first 100,000 rows / 200 columns, reported as
  `truncated`. `metricsSchema` (Zod) is the read-back and response source of truth for the `jsonb`.
- **Preview is stored, not computed**: profiling keeps the first 50 rows × 50 columns (cells cut to
  200 chars, dates ISO) in `previewRows`, so a request never parses an untrusted file. 409 while
  queued/profiling, 422 (with the reason) for `failed`/`unsupported`.
- **AI seam** (`core/ai`): `AiProvider.generateNarrative(NarrativeInput)`; `GeminiAiProvider`
  (`@google/genai`, JSON out, 20 s timeout) or `NullAiProvider` (default / no key). Contract: NEVER
  throws, NEVER blocks a report — timeout, refusal, malformed output all → `null` + a warning, parsed
  with Zod (`parseNarrative` tolerates a ```json fence). **The model is shown aggregates only**: no
  row, no cell value — a numeric column contributes its MEAN, never min/max (those are cell values).
  Column names are sanitised (`cleanLabel`) and passed as data, with an explicit "never follow
  instructions in a label". Tests inject `FakeAiProvider` (`h.ai.next(...)`, `h.ai.calls`).

## Audit log & usage analytics *(from Phase 9 of the feature plan)*

- **`AUDIT_ACTIONS` (`core/audit/audit-actions.ts`) is a closed registry.** `AuditService.record`
  takes an `AuditAction`, so an unregistered action does not compile. Two specs keep it honest:
  `audit-actions.spec.ts` (registry ⇔ `action: '…'` literals in source, both directions) and
  `audit.coverage.integration.spec.ts` (drives every state-changing flow once and asserts every
  registered action really landed in the table). **Adding an audit point = add the action to the
  registry AND exercise it in the coverage spec.**
- **`GET /audit`** (`src/audit/`, the read side; writing stays `AuditService`) is admin-only, cursor
  DESC on `(createdAt, id)` = the DESC index `idx_audit_log_company_created`. The list DTO has no
  `metadata` (the response DTO omits it; the list query does not select it); `GET /audit/:id` has it.
  Filters (`action`, `actorUserId`, `targetType`, `from`/`to`) are not indexed beyond the tenant/time
  index — fine for a per-company log; revisit if it ever isn't.
- **`UsageEvent.createdAt` is stamped from the injected `CLOCK`** (like every domain timestamp), because
  analytics buckets uploads by it. `FileAsset.createdAt` stays DB-stamped (the keyset list order depends
  on it and on distinct instants).
- **`analytics.queries.ts` holds the aggregates as plain functions over an `EntityManager`** so the
  read-only GraphQL surface (Phase 13) calls the SAME ones. Every aggregate is parsed with Zod (Postgres
  returns `COUNT`/`SUM` as strings). `GET /analytics/usage?from&to`: UTC days, `to` exclusive, ≤ 366 days,
  default = current period so far; the quota burn-down is ALWAYS the current period and counts by
  `periodKey`, so it equals the running bill's file count. A deleted file still counts as an upload.

## Personal API keys *(from Phase 10 of the feature plan)*

- **A key is a NAME for its creator, not a second kind of user.** `Authorization: Bearer gl_live_<8 hex>_<43 base64url>`
  (`api-keys/api-key-token.ts`). `AuthGuard` routes a `gl_live_` bearer to `ApiKeyAuthenticationService`
  (in `auth/`, beside the JWT one); everything else is a JWT. It looks the key up by SHA-256, then **re-reads the
  creator's row on every request**: their live role and status, their company's status. Disable or demote the
  creator and the next request changes with them. Every "no" (malformed, unknown, revoked, creator gone/disabled)
  is the SAME 401 message.
- **`request.user.authMethod` is `'jwt' | 'api_key'`**; a key request also carries `scopes` (already narrowed by
  `effectiveScopes(role, granted)`) and `apiKeyId`. `RequestContextService.setAuthenticated` puts `apiKeyId` in
  CLS and `AuditService.record` merges it into `metadata.apiKeyId`, so the trail says which key acted. Everything
  downstream (services, visibility, quotas, uploader) sees just the creator — that is the design.
- **`ScopesGuard` is DENY-BY-DEFAULT for keys.** A key request is refused (403) unless the route declares
  `@RequireScopes(...)` AND the key holds every scope; sessions pass through untouched. So sign-in, credentials,
  identities, employees, plan changes, audit, analytics and `/api-keys` itself are closed to keys **without
  anyone remembering to close them**, and a leaked key cannot mint persistence. Handler-level `@RequireScopes`
  overrides class-level (`getAllAndOverride`): `FilesController` is `files:read` with `files:write` on
  POST/PATCH/DELETE. `GET /subscriptions/me` = `files:read`; `BillingController` = `billing:read` (still
  `@Roles('admin')`). **A new route is unreachable by keys until someone adds `@RequireScopes` on purpose.**
- **Scopes** are `API_SCOPES` in `require-scopes.decorator.ts` (`files:read`, `files:write`, `billing:read`);
  `route-audit.spec.ts` checks every declared value against it. An employee cannot put `billing:read` on a key
  (403 at creation), and `effectiveScopes` drops it again per request if the creator's role changes.
- **Routes** (`src/api-keys/`, `@Roles('admin','employee')`, session only, no plan needed): `POST /api-keys`
  returns the plaintext **once** (`key`; only the hash is stored — never log or audit it), `GET /api-keys`
  (offset; admin sees the company's, an employee only their own, newest first), `DELETE /api-keys/:id` (revoke;
  an admin any, an employee only their own — someone else's is a **404**; idempotent, audits once).
- **Cap: 25 active keys per person.** Creation locks the creator's `user` row (`FOR UPDATE`) so two requests
  cannot both take the last slot (proved by holding the lock in a test). Revoked keys do not count.
- **`lastUsedAt` is approximate** — written by a conditional `UPDATE` at most once per
  `LAST_USED_GRANULARITY_MS` (5 min), so authenticating is not a write per request.
- **`EmployeesService.disable` revokes the person's keys** and records the count in `employee.disabled`
  metadata (`revokedApiKeys`). It is tidiness, not the mechanism (the live re-read already 401s them); reactivation
  does not bring them back.
- `ApiKey` indexes: UNIQUE `keyHash`, `(companyId, createdAt)`, `(companyId, createdByUserId)`.
- Tests: `h.createApiKey(session, { name, scopes })` and `h.upload(session, { bearer: key })` in the harness.

## Rate limiting & demo mode *(from Phase 11 of the feature plan)*

- **The infrastructure limit IS the product limit.** `PLAN_CATALOG[plan].rateLimitPerMinute` (Free 30 / Basic 120 /
  Premium 600) is the budget of the WHOLE company per minute — every user and every API key of one company share it.
  `throttling/PlanThrottlerGuard` extends `@nestjs/throttler`'s `ThrottlerGuard`; it is a global guard right after
  `AuthGuard` (it needs the tenant). Authenticated requests are counted per company at the plan's limit (no
  subscription = Free); unauthenticated ones per client address at a general 120/min. Counts are **in process
  memory** (single instance; `ThrottlerStorage` is the seam if that ever changes).
- **The plan is part of the counter's key.** A throttler counter that has been exceeded stays blocked for the rest
  of its window whatever the limit later becomes, so upgrading would not end a 429. Keying by `company:<id>:<plan>`
  gives an upgrading company a fresh counter at once (proved in the spec).
- **`@StrictThrottle(limit)`** (`throttling/strict-throttle.decorator.ts`) gives a route a small bucket of its own,
  per address (public routes) or company (signed-in): login 10, register/reset/accept-invite 10, forgot-password and
  resend-activation 5, `POST /auth/demo` 20 — and `POST`/`PATCH /subscriptions/me` 10, so a company that ran out of
  requests can still upgrade. Strict buckets neither spend nor share the general budget. `@SkipThrottle()` on `/health`.
- **Headers:** `X-RateLimit-Limit/Remaining/Reset` on every throttled response, `Retry-After` and a 429 body that
  names the plan, its limit, the retry time and the next plan up (`throttleMessage`, unit-tested).
- **`RATE_LIMIT_ENABLED`** (default on) — the integration config turns it OFF (specs make hundreds of requests per
  company); `AppHarness.start({ rateLimit: true })` turns it on for the throttling spec, and `h.clientAddress` gives a
  spec its own address (`X-Forwarded-For`) so per-address tests do not share 127.0.0.1's budget.
- **`TRUST_PROXY`** (hops; default 0; docker-compose sets 1) is applied in `main.ts` (`app.set('trust proxy', n)`).
  It decides what `req.ip` is, so it decides audit `ip` and every per-address limit. Too high lets a client choose
  its own address. The harness never runs `main.ts`; the throttling spec sets it on the Express instance itself.
- **Demo mode.** `Company.isDemo` (migration `DemoCompany`). `npm run seed:demo` (`dist/demo/seed-demo.js`, a
  standalone app context) runs `DemoSeedService`: Basic plan, an admin + three employees, six CSVs (one restricted)
  stored through the real storage driver with real data-quality reports (profiled by the real engine, narrative from
  the configured AI provider), an audit trail, and a finalized invoice from the REAL `InvoicingService.rollForward`
  over a period that has already closed. Idempotent (an existing `isDemo` company means "done"; the unique billing
  address settles a race). It deletes the invoice email the rollover queues — the demo company must never email anyone.
  The demo admin has **no password identity**: `POST /auth/demo` (public, in `demo/`, tagged `auth`) starts a session
  for it directly, which is safe only because of the next rule.
- **`DemoReadOnlyGuard`** (global, right after the throttler): any request by a user whose company is a demo and
  whose method is not GET/HEAD/OPTIONS gets 403 with `DEMO_READ_ONLY_MESSAGE` — sessions and API keys alike, every
  route including ones added later. `AuthenticatedUser.isDemo` comes from the company row in both authenticators.
  Reads are safe to leave open because every read route is a pure read.
- Global guard order is now Auth → Throttler → DemoReadOnly → Scopes → Roles → RequireSubscription.

## Realtime *(from Phase 12 of the feature plan)*

- **Socket.IO, push-only** (`src/realtime/`, `@nestjs/websockets` + `platform-socket.io`). Not part of the OpenAPI
  document (documented here and in the README). Caddy already forwards `/socket.io/*` to the API. Clients connect
  with `io(url, { auth: { token } })` using the same access token the REST API takes.
- **Auth is a handshake middleware** (`RealtimeGateway.afterInit` → `server.use`), before a connection exists, using
  the SAME `AuthenticationService` as the REST guard (user row re-read: disabled person / non-active company =
  refused, one `Unauthorized` message). API keys are refused (an HTTP integration, not a live screen). A socket is
  validated at connect only; an employee's REMOVAL closes their sockets (`EmployeesService.disable` →
  `RealtimeEmitter.disconnectUser`). An expired 15-minute token does not close an open socket — the client reconnects
  with a fresh one; nothing is ever emitted to a room its holder no longer belongs to.
- **Rooms:** `company:<id>`, `user:<id>`, `admins:<companyId>` (admins only) — helpers in `realtime-events.ts`.
- **Events** (`ServerToClientEvents`): `file.status {fileId,status,error}` (report `queued → profiling → ready |
  failed | unsupported`), `quota.updated {plan,periodKey,filesUsed,filesLimit}`, `audit.appended` (no `metadata`).
- **The audience is decided at EMIT time from the database** (`RealtimeEmitter.audience`): a company-visible file
  goes to the company room; a restricted one ONLY to `admins`, the uploader's and each grantee's user room — the
  visibility rule applied to rooms. So a file whose access changed is announced to who may see it now.
- **Emit only after commit, never inside a transaction.** `FilesService.upload` emits after its transaction returns;
  the report handler after each status write. Audit entries are written INSIDE transactions, so `AuditBroadcaster`
  (a TypeORM subscriber, registered at runtime by `RealtimeModule.onModuleInit` since a subscriber has no DI) parks
  each insert against its query runner and releases it in `afterTransactionCommit` (drops it on rollback).
- **Best effort, never fatal:** every `RealtimeEmitter` method swallows and logs its own error; a realtime outage
  must not fail an upload or a report job (clients recover by reading REST, the source of truth). The module is
  `@Global` and only registered in the full app, so CLI contexts (billing cycle, demo seed) broadcast nothing.
- Tests: `app.listen(0)` + `socket.io-client` (`test/support/socket-client.ts`: `connect`, `Listener.waitFor`,
  `settle`). Negative assertions ("the third employee got nothing") wait `settle()` first.

## Pagination & sorting *(from Phase 3)*

- Two shapes, chosen by growth pattern, both in `src/common/pagination/` —
  never redeclared inside a domain module (Project-2's worst structural
  mistake was `PaginatedResult<T>` living inside `products.service.ts`,
  imported by eight other modules).
  - **Offset** (`OffsetQueryDto` → `OffsetPage<T>`) for small, bounded lists
    that want real page numbers: employees, invoices, API keys.
  - **Cursor** (`CursorQueryDto` → `CursorPage<T>`, via `applyCursor` +
    `toCursorPage`) for append-only, potentially large, time-ordered lists:
    files, audit log. The cursor is an opaque `(createdAt, id)` pair — never
    `createdAt` alone, or two rows in the same millisecond break the page
    boundary. Proven against real Postgres, including a deliberate
    same-millisecond collision, in
    `src/database/keyset-pagination.integration.spec.ts` (the raw technique)
    and `src/common/pagination/paginate.integration.spec.ts` (the reusable
    helpers).
- `ParseSortPipe`'s whitelist is a **constructor argument**
  (`new ParseSortPipe(['createdAt', 'fileName'])`), not a `@SortableFields()`
  route decorator as first sketched — verified against `@nestjs/common`'s own
  types: a `PipeTransform` receives only `{ type, metatype, data }`, with no
  access to the controller class or method, so it structurally cannot read
  metadata a decorator set on the route handler. Never make the whitelist
  wider than the entity's actual indexed columns.
- **Filter-DTO convention** (first built for `GET /employees`, see
  `EmployeesQueryDto extends OffsetQueryDto`): one typed filter DTO per resource,
  validated by the global `ValidationPipe`, translated into conditional
  `QueryBuilder.andWhere()` calls built up one at a time. Never string-concatenated
  SQL. On a tenant-scoped resource, `TenantScope`'s predicate always applies
  **first**; a filter narrows what a caller sees, never widens it. An unknown
  query parameter is a 400 (`forbidNonWhitelisted`), not silently ignored.
- **A paginated response is a named class**, built with the `OffsetPageOf(ItemDto)`
  mixin: `export class EmployeePageDto extends OffsetPageOf(EmployeeDto) {}`. The
  subclass gives the OpenAPI schema a unique name showing the real item type, and
  gives `route-audit.spec.ts` a `type` to check (a bare `@ApiOkResponse({ schema })`
  would carry none). Map with `toDto(PageDto, mapPageData(page, ItemDto.from))`.

## File-type validation *(deferred to Milestone 7 — do not build early)*

Nest 12's built-in `FileTypeValidator` already performs real magic-byte
detection by default (`fileTypeFromBuffer` from the `file-type` package,
verified in the installed `@nestjs/common` source — `skipMagicNumbersValidation`
defaults to `false`). The premise for a hand-rolled `MagicByteValidator` — "the
built-in only trusts the reported MIME type" — was true in older Nest
versions and is **false** for this one. Do not build one.

The real remaining gap: **CSV has no magic bytes at all.**
`fileTypeFromBuffer` returns `undefined` for plain text (verified: a real CSV
buffer detects as `undefined`), so relying on the built-in validator alone
would reject every legitimate CSV upload unless `fallbackToMimetype: true` is
set — which reopens the exact spoofing hole (a renamed `.exe` claiming
`Content-Type: text/csv`) this validation exists to close. Closing it
properly needs a resource-aware heuristic (reject known binary signatures,
confirm the buffer is plausibly UTF-8 text) that only makes sense once
`files/`'s real MIME list and upload endpoint exist — build it there, in
Milestone 7, not as generic HTTP-kit plumbing now.

## Errors

- Throw Nest's built-in HTTP exceptions (`NotFoundException`,
  `ForbiddenException`, …), not generic `Error`. No custom exception classes.
- A resource the caller may not see returns **404, not 403** — its existence is
  not disclosed.
- The global filter renders every failure as
  `{ statusCode, message, correlationId, timestamp }`. Do not add per-controller
  try/catch to reshape errors.

## Responses

- Return **explicit response DTOs**, never raw entities. Enforced by a spec.
- Map with `toDto(DtoClass, entity)` / `toDtoList(DtoClass, entities)` from
  `src/common/response/to-dto.ts` (a thin wrapper over
  `plainToInstance(Dto, entity, { excludeExtraneousValues: true })`) and
  `@Expose()` on the DTO; give each DTO its own `static from(entity)` that
  calls `toDto` internally.
- This is opt-in by design: forget a field and something is visibly missing,
  rather than a new column leaking silently.
- For a paginated response, map the page's `data` through the DTO with
  `mapPageData(page, DtoClass.from)` from `src/common/pagination/paginate.ts`
  — this is the "one shared `toPaginated()`" — leaving `meta` untouched and
  working identically for both `OffsetPage` and `CursorPage`.

## Platform services *(from Phase 1 of the feature plan)*

- **Time goes through `CLOCK`** (`src/core/clock/`), never `new Date()` in
  domain logic: token expiry, billing periods, proration, the task backoff.
  Inject `@Inject(CLOCK) clock: Clock`; tests use `test/support/fake-clock.ts`.
- **Slow or external work goes through the task queue, not inline.**
  `TaskQueue.enqueue(type, payload, { manager })` — pass the caller's
  `EntityManager` so the task exists only if the surrounding transaction
  commits (a rolled-back registration must not send an activation email).
  It is a durable job queue (`FOR UPDATE SKIP LOCKED`, exponential backoff,
  dead after 5 attempts), **not an event bus**.
- **Adding a task type**: add it to `BACKGROUND_TASK_TYPES` in
  `background-task.entity.ts` plus a migration (`ALTER TYPE
  background_task_type ADD VALUE`), write a `TaskHandler` with a Zod payload
  schema (the `jsonb` column is untyped by definition), and register it in
  `TaskRunnerModule`'s `TASK_HANDLERS` factory. Forgetting the last step
  parks that type's tasks as `dead` with "No handler registered".
- **Email is never sent directly.** Enqueue a `send_email` task whose payload
  is a `MailMessage` (`core/mail/mail-message.ts` — one Zod schema per
  template, so a missing variable fails at the boundary). `MailService.send`
  is called only by `SendEmailHandler`. Templates are MJML + Handlebars held
  as TS strings in `templates.ts` (no asset pipeline), compiled once at boot;
  brand colors are literal hex in `brand.ts` until the Milestone 2 brand pass.
- **Audit**: `AuditService.record({ action, target, metadata }, manager?)`.
  Pass the caller's `manager` so the entry commits with the change it
  describes. Flows with no authenticated request (registration, activation,
  the task runner) pass `companyId` and `actorUserId` explicitly; otherwise the
  tenant, actor, ip and correlation id come from request context. The table is
  immutable at the database level (a trigger rejects UPDATE/DELETE), so there
  is deliberately no edit or delete method.
- `action`/`targetType` on the audit log are open-ended text, not Postgres
  enums, unlike the small closed `status`/`type` vocabularies elsewhere — a new
  action per feature would otherwise cost an `ALTER TYPE` migration each time.

## Testing

- Colocate `*.spec.ts` next to the file under test. Suffix anything that needs a
  real database `*.integration.spec.ts` — `npm test` excludes those, `npm run
  test:int` runs them. **There is no e2e tier**: HTTP behaviour is covered by
  integration specs against the real database.
- Integration specs construct the service under test directly against
  `PostgresTestContext` (see `tenant-scope.integration.spec.ts`); a
  `ClsService` needs only `new ClsService(new AsyncLocalStorage())`.
  `PostgresTestContext.stop()` resets first, because the specs share the
  developer's database and a running dev server's task scheduler will execute
  leftover `background_task` rows.
- A test that "passes first time" proves little for concurrency or locking
  code — mutate the implementation (e.g. remove `.setOnLocked('skip_locked')`)
  and confirm the test fails. The SKIP LOCKED spec holds row locks in an open
  transaction rather than racing, so it is deterministic.
- Prefer asserting metadata over booting the app for decorator-time wiring
  (`Reflect.getMetadata('imports', SomeModule)`).
- Specs that re-import `AppModule` after `vi.resetModules()` need a generous
  timeout: a cold import of the Nest/TypeORM/Swagger graph is seconds on a
  slow disk.
- Pure functions with an injected clock over anything time-dependent. The
  billing calculator is the most heavily tested file in the repo.

## API documentation

- `@ApiTags` exactly once per controller, and an `@ApiOkResponse`/
  `@ApiCreatedResponse` whose `type` is a response DTO — not an entity class.
  `route-audit.spec.ts` enforces both, exempting `HealthController`'s response
  type (Terminus's own dynamic `HealthCheckResult`, not a domain DTO).
- **No `@ApiOperation`.** Prose lives entirely in `docs/descriptions/*.yaml`,
  keyed by the generated `operationId` (`${ControllerKey}_${methodKey}`, set
  by the explicit `operationIdFactory` in `swagger-document.ts` — the default
  factory's key format would silently orphan every prose entry on a
  controller rename), merged post-generation by `mergeProse()`. Keeps
  controllers readable and copy editable in one sitting with the whole API in
  view, rather than scattered across `@ApiOperation({ description })` calls.
  `npm run docs:generate` fails, naming the operationId, when one has no
  matching prose entry.
- **No `@nestjs/swagger` CLI plugin** — it is a tsc transformer, so the
  document's completeness would depend on how the generator was invoked. Write
  `@ApiProperty` explicitly.
- `docs/openapi.yaml`, its per-tag split under `docs/openapi/`, and
  `docs/openapi.d.ts` are generated and committed. Never hand-edit them —
  `npm run docs:check` diffs a fresh regeneration against what's committed.
- `/reference` (Scalar) needs a per-request CSP nonce, not `'unsafe-inline'`,
  because Scalar's renderer embeds its bootstrap as an inline `<script>` (see
  `@scalar/client-side-rendering`'s `getScriptTags`). `main.ts` mints one nonce
  per request into `res.locals[CSP_NONCE_LOCALS_KEY]` *before* helmet runs —
  helmet's `script-src` directive and `mountScalarReference`'s handler both
  read the same value back, via `docs/csp-nonce.ts`'s shared key. Passing a
  `nonce` also makes Scalar choose its single-file UMD bundle over the ESM
  build, which is required: the ESM build's `import`-loaded chunks can't carry
  a nonce at all.

## Index checklist

The full index plan from SCOPE.md. Tick each off as its table lands, and extend
`indexes.integration.spec.ts`'s `pg_indexes` assertions in the same change —
every `[x]` below has a corresponding assertion there, not just a claim here.

- [x] `auth_identity` — UNIQUE `(provider, providerUserId)`, UNIQUE `(userId, provider)`, UNIQUE `lower(email)` for password identities (partial), plus a plain
      index on `userId` (not covered by the unique index, needed for "every
      identity for this user")
- [x] `auth_token` — UNIQUE `(tokenHash)`, plus a plain index on `userId`
- [x] `refresh_token` — UNIQUE `(tokenHash)`, plus a plain index on `userId`
- [x] `company` — UNIQUE `(billingEmail)`
- [x] `user` — UNIQUE `(companyId, email)`, leading with `companyId` — no
      separate tenant index needed, this composite already serves it
- [x] `file_asset` — `(companyId, deletedAt, createdAt)` + partial
      `(companyId, createdAt) WHERE deleted_at IS NULL`
- [x] `file_access_grant` — UNIQUE `(fileId, userId)` (+ plain `userId`); `idempotency_record` — UNIQUE `(companyId, key)`
- [x] `usage_event` — `(companyId, periodKey)`
- [x] `audit_log_entry` — `(companyId, createdAt DESC, id)`
- [x] `subscription` — UNIQUE `(companyId)`; `subscription_change` —
      `(companyId, effectiveAt)`; `invoice` — UNIQUE `(companyId, periodStart)`
      (also what makes the rollover idempotent); `seat_interval` —
      `(companyId, activeFrom)` + `(userId)`
- [x] `data_quality_report` — UNIQUE `(fileId)`, `(companyId, status)`
- [x] `api_key` — UNIQUE `(keyHash)`, `(companyId, createdAt)`, `(companyId, createdByUserId)`
- [x] Deliberately **not** indexed: `invoice.lineItems`,
      `background_task.payload` — opaque jsonb read only by primary key.
      The `background_task` claim index `(status, runAfter)` is infra, not
      tenant-scoped, and is asserted alongside.

## Platform

Windows/PowerShell. No npm script may use inline env assignment
(`FOO=1 node …` is a PowerShell parse error) — use `process.loadEnvFile` plus an
argv flag.
