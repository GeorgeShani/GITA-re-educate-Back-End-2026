# 3legant Golf — API

Event-driven e-commerce backend for a golf storefront. NestJS 11, MongoDB
Atlas, BullMQ, Stripe, Cloudinary, and a Gemini-powered shopping assistant.

See the [repo root README](../README.md) for the project overview and the
combined quick start. This file covers running and working on the API itself.

**Status:** complete and stable — the full domain model, the event backbone,
and the 19-area admin surface are built, tested, and pushed. The frontend
(`../frontend/`) consumes essentially all of it against this live API, not mock
fixtures. See [`../frontend/README.md`](../frontend/README.md) for that side.

---

## Architecture in one paragraph

Every state change goes through a command handler that writes the entity **and**
an outbox row inside a single MongoDB transaction. A change-stream relay picks
up unpublished outbox rows, claims each one with `findOneAndUpdate` so
concurrent relays cannot double-publish, and dispatches to BullMQ. Consumers
are idempotent on `event._id`. A single correlation id spans HTTP request →
command → domain event → queue job → email → audit-log entry, so any user
action can be traced end to end. Nothing is ever published to a queue from
inside a transaction.

```
HTTP → CommandBus → handler ─┬─ entity write   ┐
                             └─ outbox write   ┘ one transaction
                                    ↓
                        change-stream relay (claims row)
                                    ↓
                          BullMQ → consumers → email / audit / media / invoice
```

**Scaling:** `ROLE` selects what a process runs. `worker` owns everything that
happens on its own schedule — the outbox relay, all four BullMQ consumers, the
every-minute stale-order sweep, and the hourly sitemap rebuild. `api` runs none
of them and skips Swagger. `all` (the default) does both, which is right for
local dev and a single instance.

It matters the moment you run more than one process: two relays race for the
same outbox rows, and two sweeps dispatch the same CancelOrderCommand for the
same batch every minute. `GET /health` reports the role so you can confirm what
a deployed instance is actually doing.

**Layout:** `src/core/` holds the event backbone (outbox, relay, buses, queues,
audit log). Every other top-level folder is a domain module that owns its
schemas, DTOs, commands, handlers, and controllers. Admin controllers are
co-located with the resource they manage (`catalog/admin-products.controller.ts`),
not gathered into one admin module — only genuinely cross-cutting admin surfaces
(dashboard, audit log) live in `src/admin/`.

---

## Quick start

```bash
npm install
cp .env.example .env
```

Fill in `.env` — [`docs/ENV_SECRETS_GUIDE.md`](./docs/ENV_SECRETS_GUIDE.md)
walks through every single value, where to click to get it, and which ones you
can safely leave blank. The short version: MongoDB Atlas and Redis are
required, three secrets you generate yourself are required, and everything else
has a working offline default (`PAYMENT_PROVIDER=mock`, `MAIL_PROVIDER=console`).

**Atlas must be a replica set.** The M0 free tier is one. Transactions and
change streams both require it, so a standalone `mongod` will not work.

```bash
npm run start:dev
```

Then populate the database and grant yourself admin:

```bash
npm run seed:all                            # wipes the DB, then reseeds every entity
npm run promote-admin -- you@example.com    # after registering normally
```

`seed:all` runs, in dependency order: `seed:reset` (drops the DB — refuses a
non-local `MONGODB_URI` without `FORCE_SEED_RESET=1`), `seed:users` (staff +
customers, all with password `Password123!`), `seed:catalog` (~105 golf
products + images), `seed:commerce` (shipping, tax, coupons, gift cards — one
coupon is marked `isFeatured` and drives the storefront's sale banner),
`seed:content` (blog + pages), `seed:orders`, `seed:reviews`. Each step is also
its own script if you only need one. `seed:catalog` and `seed:content` each
make one Pexels + one Cloudinary round trip per item, rate-limited to stay
under Pexels' free-tier 200/hour cap.

`promote-admin` exists because no HTTP route can ever mint the first admin —
registration always assigns `[customer]`.

**Search** runs on a MongoDB `$text` index out of the box
(`SEARCH_PROVIDER=mongo`, the default). Set `SEARCH_PROVIDER=atlas` only after
provisioning the `products_search` Atlas Search index by hand — see
[`docs/ENV_SECRETS_GUIDE.md`](./docs/ENV_SECRETS_GUIDE.md).

- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/api`
- Health: `http://localhost:4000/health`
- Queues: `http://localhost:4000/admin/queues` (only if Bull Board creds are set)

The frontend (`../frontend/`) proxies `/api` to this port in dev — see
[`../frontend/README.md`](../frontend/README.md). If `PORT` is ever changed
here, `frontend/proxy.conf.json` and `frontend/src/app/app.config.server.ts`'s
SSR `apiOrigin` fallback both need updating too; they don't read this `.env`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Watch-mode dev server |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | `node dist/main` |
| `npm test` | Full test suite |
| `npm run lint` | ESLint with `--fix` |
| `npm run seed:all` | Wipe the DB and reseed every entity (runs the steps below) |
| `npm run seed:reset` | Drop the database (local/dev only unless `FORCE_SEED_RESET=1`) |
| `npm run seed:users` | Staff + customers (password `Password123!`) |
| `npm run seed:catalog` | ~105 products, categories, inventory, images |
| `npm run seed:commerce` | Coupons, gift cards, shipping zones, tax rates |
| `npm run seed:content` | Blog posts, tags, and CMS pages |
| `npm run seed:orders` | Backdated order history for the seeded customers |
| `npm run seed:reviews` | Product reviews + rating rollup |
| `npm run backfill-ratings` | Recompute `Product.ratingAverage`/`ratingCount` from approved reviews |
| `npm run promote-admin -- <email>` | Grant the admin role |
| `npm run mail:preview` | Render every email template to `dist/mail-out/` |

---

## Things that will bite you

Collected because each one has already cost someone an afternoon.

**Money is integer minor units everywhere.** `basePriceMinor: 4499` is $44.99.
Never floats, never `Decimal128`. Format at the presentation edge only.

**`forbidNonWhitelisted: true`.** Sending a property that isn't on the DTO is a
`400`, not a silent strip. Client payloads must match DTOs exactly.

**Refresh tokens rotate with reuse detection.** Presenting an
already-rotated token revokes *every* active session for that user. A client
firing two concurrent refreshes with the same token will log itself out
everywhere — refresh must be single-flight. See
[`src/auth/auth.integration.spec.ts`](./src/auth/auth.integration.spec.ts) for
the exact blast radius.

**Guest carts ride a signed httpOnly cookie (`gct`, `sameSite: lax`).** Not a
header. Clients must send credentials, and a cross-origin browser will silently
drop it — front ends should proxy the API same-origin in dev.

**`CartSummary` returns `subtotalMinor` only.** No discount, tax, shipping, or
total. Applying a coupon just echoes the code back; the monetary effect
materialises at `GET /checkout/quote` and on the placed order.

**Assistant SSE runs over `POST`.** `@Sse()` sits on `@Post()` handlers, so the
browser `EventSource` API cannot be used (GET-only, no `Authorization` header).
Clients need `fetch` + `ReadableStream` + an SSE parser.

**Order status is webhook-driven.** `place-order` returns before payment
settles; `placed → paid → confirmed` happens out of band. Clients poll
`GET /orders/:id`. In dev with `PAYMENT_PROVIDER=mock`, drive the saga with
`POST /payments/mock/:id/succeed`.

**`WRITE_THROTTLE` is 5 requests/minute** on most mutations, including cart
quantity changes. Debounce accordingly.

**Never write `type: Types.ObjectId` in a `@Prop()`.** It is the BSON *value*
class, not a SchemaType. `@nestjs/mongoose` silently collapses the field to
`Mixed`, which stores fine but does zero query casting — so a query filtering by
the string form of an id matches nothing. Use
`Schema.Types.ObjectId` (imported as `MongooseSchema`). This was real, shipped,
and undetected for ten slices because `tsc` cannot catch it.

---

## Testing

```bash
npm test
```

Integration tests run against a real single-node replica set via
`mongodb-memory-server` (`test/support/mongo-memory-server.ts`) — transactions
and change streams need one, and the ObjectId bug above proves that only a real
query catches a whole class of schema defect.

Current coverage is deliberately concentrated on the highest-risk mechanics
rather than spread thin: the outbox relay's claim/resume behaviour, the order
state machine and its compensation path, cart and coupon rules, email
idempotency and the dev-send gate, RBAC on every admin controller, per-user
assistant scoping, auth token rotation with reuse detection, category-descendant
filtering with its pagination and sort ordering, and the api/worker role gate.

Broad controller and admin-CRUD coverage is **not** there yet — see Known gaps.

---

## Known gaps

Recorded so they read as decisions rather than surprises.

- **Saved payment methods aren't wired into checkout.** `PlaceOrderDto` has no
  `paymentMethodId`, so the saved-card list is management-only — every checkout
  collects card details fresh. Finishing it means threading a payment method
  through `PlaceOrderCommand` into the PaymentIntent.
- **Upload limits need one dashboard step.** `CLOUDINARY_UPLOAD_PRESET` is now
  signed into the upload params when set, so Cloudinary can enforce
  `allowed_formats` / `max_file_size` / moderation server-side — but the preset
  itself has to be created in the Cloudinary dashboard. Left unset, uploads are
  authorised by folder alone.
- **Test coverage is concentrated, not broad.** The highest-risk mechanics are
  covered (see Testing); most controllers and all 19 admin CRUD surfaces are
  not. That is a deliberate ordering, not an oversight, but it is real.
