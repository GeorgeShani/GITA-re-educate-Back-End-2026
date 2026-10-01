# Gridline backend implementation audit

This document records what the backend implements, how each promise is proved,
and what remains deliberately outside the backend scope. The source of truth
for product intent is [`../../SCOPE.md`](../../SCOPE.md); this file is the
implementation cross-check.

## Audit result

The complete 40-point backend brief is implemented. Backend product phases 1
through 21 are also implemented. The REST contract is generated and checked,
the GraphQL schema is generated and committed, and Socket.IO's typed contract
is tested directly.

The final audit found and fixed five concrete mismatches:

| Finding | Resolution |
|---|---|
| Outgoing webhook delivery history had no promised 30-day cleanup | Added a daily `WebhookDeliveriesJanitor`, deterministic retention tests and a `createdAt` index/migration. |
| Production could omit the declared CloudFront brand origin | Production config now requires an HTTPS `ASSETS_BASE_URL`; development retains the text-wordmark fallback. |
| `JWT_REFRESH_SECRET` was mandatory but unused | Removed it. Refresh tokens are opaque random values, hashed at rest and rotated by family. |
| `exceljs` pulled a vulnerable old `uuid` transitive dependency | Added a scoped override to `uuid@11.1.1`; XLSX unit/integration tests pass and `npm audit` reports zero vulnerabilities. |
| Scope, overview and source comments still described pre-Stripe and pre-socket-refresh behavior | Reconciled `SCOPE.md`, `README.md`, `AGENTS.md`, `docs/OVERVIEW.md` and the affected source comments. |

`typeorm schema:log` reports no entity/migration drift after the retention
migration is applied.

## Assignment requirements

| Requirement | Status | Implementation and proof |
|---|---|---|
| Registration, JWT and email activation | Complete | `src/auth/`, opaque refresh rotation, single-use hashed activation tokens, durable MJML email tasks; `src/auth/registration.integration.spec.ts`, `src/auth/session.integration.spec.ts`. |
| Company registration and activation | Complete | Five-field transaction creates company, admin, password identity and activation task; inactive login is refused; resend does not disclose account existence. |
| Password and profile changes | Complete | Password change/reset revokes refresh families; `PATCH /users/me` and admin-only `PATCH /companies/me`; auth/company integration specs. |
| Free, Basic and Premium plan logic | Complete | `PLAN_CATALOG`, mandatory selection, downgrade constraints, Stripe Checkout/webhook activation for paid plans; subscription and payment integration specs. |
| Employee invite, activation and removal | Complete | Email invite, password or Google acceptance, locked seat caps, soft-disable and reactivation; `src/employees/employees.integration.spec.ts`. |
| Admin/employee RBAC | Complete | Opt-out global guard chain, route metadata audit, tenant scope and projection-only member list; access-control and route-audit specs. |
| CSV/XLS/XLSX upload and storage | Complete | Byte-based sniffing, 25 MB cap, S3/local provider seam, presigned download, transaction-safe usage/task/audit writes; file and storage specs. |
| Company/restricted file visibility | Complete | One visibility predicate reused by REST, reports, versions, comments, realtime and GraphQL; hidden resources return 404; file/GraphQL integration specs. |
| File deletion and permission changes | Complete | Uploader/admin access updates, relational grants, soft-delete plus object deletion, latest-version promotion; file/version integration specs. |
| Current billing, prices and people count | Complete | Running local estimate, Stripe invoice mirrors, portal recovery, Basic seat synchronization, Premium meter events, dunning and reactivation; billing/payment specs. |
| Additional functionality | Complete | Reports, quality rules, immutable audit, analytics, notifications, versions, comments/presence, outgoing webhooks and GraphQL. |

## Foundation and reliability

- Zod-validated configuration, Pino redaction, CLS correlation/tenant context,
  health checks and optional Observe instrumentation.
- Explicit TypeORM entities and migrations, `synchronize: false`, Neon pooled
  runtime URL versus direct migration URL, and live `pg_indexes` assertions.
- Durable Postgres task queue with `FOR UPDATE SKIP LOCKED`, exponential
  backoff, dead-letter state and Zod-parsed payloads.
- Strict MJML + Handlebars mail templates for activation, invites, password
  flows, quota alerts, payment failure/recovery and invoice finalization.
- OpenAPI/Scalar with prose sidecars, drift checks and generated TypeScript
  types. Every controller route is audited for auth metadata, tag and response
  DTO coverage.
- Offset and keyset pagination, typed filtering/sorting, DTO-only responses,
  idempotent uploads and plan changes, retention jobs and immutable audit rows.

## Product extensions

| Feature | Contract | Important guarantees |
|---|---|---|
| Google OAuth and linked identities | `/auth/oauth/*`, `/auth/identities/*` | Provider subject is identity; invite token can bind a different email; exchange code is short-lived and single-use. |
| Personal API keys | `/api-keys` | Shown once, hash-only storage, live creator role/status, deny-by-default route scopes, automatic disable revocation. |
| Plan throttling and demo | Global guard, `POST /auth/demo` | Company-wide 30/120/600 budgets, strict auth/email buckets, read-only seeded demo. |
| Notifications and quota alerts | `/notifications` + Socket.IO | Same-transaction writes, post-commit push, once-per-period 80/100 thresholds, 90-day read retention. |
| Data-quality rules | `/quality-rules`, report rebuild | Plan caps, immutable snapshots, deterministic scores, uploader/admin failure notification. |
| File versions | `/files/:id/versions`, compare | Dataset lock, monotonic versions, inherited visibility, per-version usage/report, schema-change notification. |
| Stripe subscriptions | subscriptions, billing portal, `/webhooks/stripe` | Provider-authoritative paid plan; order-independent event handling (decided by which subscription, unit-tested for every ordering); stray subscriptions cancelled by a durable queued task; local engine never rolls or invoices a Stripe-managed company; narrow duplicate detection; ordered seat sync, meter idempotency, grace/suspension/recovery that waits for every overdue invoice. |
| CloudFront mail assets | `ASSETS_BASE_URL` | Public brand bucket only, versioned path, HTTPS in production, accessible image and development fallback. |
| Socket lifecycle | `auth.refresh`, session events | Same-user refresh only, live room rebuild, final-minute warning and expiry disconnect. |
| Comments, mentions and presence | comment REST routes + socket events | Existing file ACL first, relational mentions, tombstones, newly-mentioned notifications, deduplicated watchers, access eviction. |
| Signed outgoing webhooks | `/outgoing-webhooks` | AES-GCM secrets, exact-body HMAC, transactional publish, SSRF/DNS-rebinding defense, five attempts, failure disable, 30-day delivery retention. |
| Read-only GraphQL | `/graphql` | REST visibility parity, per-request tenant loaders, no API keys/mutations, depth 6, cost 1000, `first <= 50`. |

## Automated verification

Run the complete gate from `backend/`:

```bash
npm run build
npm run lint
npm test
npm run test:int
npm run docs:check
npm audit --audit-level=moderate
npx typeorm schema:log -d dist/database/data-source.js
```

The unit tier is database-free. The integration tier uses real Postgres and
boots the real Nest application for HTTP, GraphQL and Socket.IO behavior while
replacing only external providers (mail, storage, Google, AI, Stripe,
telemetry and outbound HTTP). Critical locks, tenant predicates, signatures,
idempotency and visibility rules were mutation-checked by deliberately breaking
them and confirming a focused test fails.

## Deployment checks that cannot be faked

Automated tests intentionally do not contact production services. Before a
real deployment:

1. Apply migrations with the direct Neon URL and confirm `migration:show` has
   no pending entry.
2. Run `npm run stripe:verify-catalog` against Stripe test mode, then forward
   signed test webhooks through the Stripe CLI.
3. Send every MJML template through the configured SMTP account and confirm
   CloudFront images load from the dedicated public-brand distribution.
4. Upload and download one spreadsheet through the real private S3 bucket.
5. Exercise Google OAuth with the deployed callback URL.
6. Confirm Observe receives a tenant-tagged request without secrets or token
   values.

## Deliberate limits

- The backend is complete; the branded Next.js product UI is a separate
  milestone.
- Rate counters and Socket.IO rooms are process-local. More than one API
  instance requires shared Redis-backed stores/adapters.
- A process crash between object upload and database commit can leave an S3
  orphan. Ordinary failures clean up, but no bucket reconciliation job exists.
- Legacy XLS files are accepted, stored and downloaded, but not profiled.
- Company export/erasure, 2FA, i18n, invoice PDFs, trash/restore and weekly
  digests are not implemented and are not presented as complete.
- The MCP server (`POST /mcp`, Phase 22) is implemented: stateless Streamable
  HTTP, API-key auth only (no OAuth), 23 tools over the same services as REST.
  Uploads through it are capped at 8 MB (larger files use `POST /files`).
  Comments, employees, plan changes, API keys, webhooks, file deletion and
  access changes are deliberately not exposed to agents.
- There is no repository CI workflow by user choice; the same gate is run
  locally before delivery.
