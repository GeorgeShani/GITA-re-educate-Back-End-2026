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
- **No `tsconfig` path aliases.** ESM has no runtime path mapping, so `@/foo`
  resolves in Vitest and then fails under `node dist/main.js`. Use relative
  imports, or package.json `"imports"` (`#core/*`) which Node resolves natively.
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

## Auth & RBAC *(from Phase 3 — built ahead of its populator)*

- `@CurrentUser()` / `@CurrentUser('userId')` reads `request.user`, typed
  `keyof AuthenticatedUser` so a typo is a compile error. Nothing populates
  `request.user` yet — that's the auth guard, Milestone 3.
- `@Public()` marks a route exempt from the global auth guard **before that
  guard exists**. Auth here is opt-out, not opt-in: once the guard is
  registered, every route needs a valid identity unless marked `@Public()`.
  Every current route must be `@Public()` or `@Roles(...)` — never neither —
  enforced by `src/common/auth/route-audit.spec.ts`.
- `@Roles('admin', …)` + `RolesGuard` — built, **not yet registered globally**.
  Absent `@Roles()` means "any authenticated user", not "admin only": the
  guard only narrows, it never widens what the auth guard already granted.
- `@RequireScopes(...)` is the API-key analogue of `@Roles`, for
  `ApiKeyGuard` (Milestone 10). A key's effective permission is
  `(creator's live role) ∩ (key's scopes)` — never wider than either.
- `@IdempotencyKey()` reads and validates the `Idempotency-Key` header.
  Returns `undefined` when absent; a route that requires one checks for that
  itself.
- **`route-audit.spec.ts` is the enforcement mechanism, not code review.**
  It discovers controllers by walking `AppModule`'s import graph, so there is
  no list to maintain: a controller in any module reachable from `AppModule`
  is audited automatically, and every route on it must satisfy the checks
  above or the build fails. A module not imported anywhere isn't a route.

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
- **Filter-DTO convention** (pattern, not yet built — no resource needs it
  before Milestone 5): one typed filter DTO per resource
  (`FilesFilterDto { mimeType?, uploaderId?, … }`), validated by the global
  `ValidationPipe`, translated into conditional `QueryBuilder.andWhere()`
  calls built up one at a time. Never string-concatenated SQL. On a
  tenant-scoped resource, `TenantScope`'s predicate always applies **first**;
  a filter narrows what a caller sees, never widens it.

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

- [x] `auth_identity` — UNIQUE `(provider, providerUserId)`, plus a plain
      index on `userId` (not covered by the unique index, needed for "every
      identity for this user")
- [x] `auth_token` — UNIQUE `(tokenHash)`, plus a plain index on `userId`
- [x] `refresh_token` — UNIQUE `(tokenHash)`, plus a plain index on `userId`
- [x] `company` — UNIQUE `(billingEmail)`
- [x] `user` — UNIQUE `(companyId, email)`, leading with `companyId` — no
      separate tenant index needed, this composite already serves it
- [ ] `file_asset` — `(companyId, deletedAt, createdAt)` + partial
      `(companyId, createdAt) WHERE deleted_at IS NULL`
- [ ] `file_access_grant` — UNIQUE `(fileId, userId)`
- [ ] `usage_event` — `(companyId, periodKey)`
- [x] `audit_log_entry` — `(companyId, createdAt DESC, id)`
- [x] Deliberately **not** indexed: `invoice.lineItems` (table not built yet),
      `background_task.payload` — opaque jsonb read only by primary key.
      The `background_task` claim index `(status, runAfter)` is infra, not
      tenant-scoped, and is asserted alongside.

## Platform

Windows/PowerShell. No npm script may use inline env assignment
(`FOO=1 node …` is a PowerShell parse error) — use `process.loadEnvFile` plus an
argv flag.
