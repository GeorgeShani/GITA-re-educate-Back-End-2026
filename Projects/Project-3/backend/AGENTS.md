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
- **Never break the canary.** `src/probe/probe.metadata.spec.ts` asserts that
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
- Map with `plainToInstance(Dto, entity, { excludeExtraneousValues: true })` and
  `@Expose()` on the DTO; one `static from(entity)` per DTO.
- This is opt-in by design: forget a field and something is visibly missing,
  rather than a new column leaking silently.

## Testing

- Colocate `*.spec.ts` next to the file under test. Suffix anything that needs a
  real database `*.integration.spec.ts` — `npm test` excludes those, `npm run
  test:int` runs them.
- Prefer asserting metadata over booting the app for decorator-time wiring
  (`Reflect.getMetadata('imports', SomeModule)`).
- Pure functions with an injected clock over anything time-dependent. The
  billing calculator is the most heavily tested file in the repo.

## API documentation *(from Phase 4)*

- `@ApiTags` exactly once per controller, `@ApiOperation` on every route, and an
  `@ApiOkResponse`/`@ApiCreatedResponse` whose `type` is a response DTO.
- **No `@nestjs/swagger` CLI plugin** — it is a tsc transformer, so the
  document's completeness would depend on how the generator was invoked. Write
  `@ApiProperty` explicitly.
- Prose lives in `docs/descriptions/*.yaml`, keyed by `operationId`, never
  inline. `npm run docs:generate` fails on an operation with no prose entry.
- `docs/openapi.yaml` is generated and committed. Never hand-edit it.

## Index checklist

The full index plan from SCOPE.md. Tick each off as its table lands, and extend
the `pg_indexes` assertion spec in the same change.

- [x] `auth_identity` — UNIQUE `(provider, providerUserId)`
- [x] `user` — UNIQUE `(companyId, email)`
- [ ] `file_asset` — `(companyId, deletedAt, createdAt)` + partial
      `(companyId, createdAt) WHERE deleted_at IS NULL`
- [ ] `file_access_grant` — UNIQUE `(fileId, userId)`
- [ ] `usage_event` — `(companyId, periodKey)`
- [ ] `audit_log_entry` — `(companyId, createdAt DESC, id)`
- [x] `refresh_token` — UNIQUE `(tokenHash)`
- [ ] Deliberately **not** indexed: `invoice.lineItems`,
      `background_task.payload` — opaque jsonb read only by primary key.

## Platform

Windows/PowerShell. No npm script may use inline env assignment
(`FOO=1 node …` is a PowerShell parse error) — use `process.loadEnvFile` plus an
argv flag.
