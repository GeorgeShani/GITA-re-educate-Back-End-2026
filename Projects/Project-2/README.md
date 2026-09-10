# 3legant Golf

A full-stack golf e-commerce platform: an event-driven NestJS API and an
Angular 22 SSR storefront with a customer account area, a blog, an AI shopping
assistant, and a 19-area staff admin panel.

```
Project-2/
├── backend/     NestJS 11 · MongoDB Atlas · BullMQ · Stripe · Cloudinary · Gemini
└── frontend/    Angular 22 (SSR) · SCSS design system · signals throughout
```

Each half has its own README with the detail that matters for working on it:

- **[backend/README.md](./backend/README.md)** — the event backbone, the
  api/worker role gate, running the API, seeding, and the things that will
  bite you.
- **[frontend/README.md](./frontend/README.md)** — the three chrome states,
  render modes, the dev proxy, and its own list of gotchas.

---

## Quick start

Two processes. The backend must be up first — the frontend talks to it only
through the dev proxy, never directly.

```bash
# 1. API  (http://localhost:4000)
cd backend
npm install
cp .env.example .env          # fill in — docs/ENV_SECRETS_GUIDE.md walks through every value
npm run start:dev

# 2. Storefront  (http://localhost:4200)
cd ../frontend
npm install
npm start
```

Then populate a database and grant yourself admin:

```bash
cd backend
npm run seed:all                          # wipes the DB, then reseeds every entity
npm run promote-admin -- you@example.com  # after registering through the app
```

`seed:all` needs `MONGODB_URI`, `CLOUDINARY_*`, and `PEXELS_API_KEY`. It runs
each step as its own process and takes a few minutes (one Pexels + one
Cloudinary round trip per product, rate-limited). Individual steps
(`seed:catalog`, `seed:users`, `seed:orders`, …) can be run on their own — see
the backend README.

**MongoDB Atlas must be a replica set.** The M0 free tier is one. Transactions
and change streams both require it.

---

## Architecture at a glance

**Backend — event-driven.** Every state change goes through a command handler
that writes the entity *and* an outbox row in one MongoDB transaction. A
change-stream relay claims each unpublished row and dispatches to BullMQ;
consumers (email, audit log, media, invoices, search re-index) are idempotent
on `event._id`. One correlation id spans HTTP request → command → event → job →
email. Nothing is published to a queue from inside a transaction.

**Frontend — one app, three chrome states.** Storefront chrome renders on every
route except `/admin/**`, which swaps to its own sidebar shell. Every route is
lazy; `app.routes.server.ts` picks Prerender / Server / Client per route.
`src/app/shared/ui/` is the design-system primitive layer — features compose
those, never duplicate them.

---

## Conventions worth knowing before you touch the code

- **Money is integer minor units everywhere** (`basePriceMinor: 4499` = $44.99).
  Never floats, never `Decimal128`. Format only at the presentation edge.
- **The design system is `frontend/src/styles/_tokens.scss`** — the single
  source for colour, spacing, radii, shadows, z-index, and motion. Component
  styles reference the custom properties; they never hardcode a value that has
  a token. Type scale is `_typography.scss`, breakpoints `_breakpoints.scss`.
- **Golf catalogue model:** ten categories (gloves, balls, tees, headcovers,
  towels, bags, rangefinders & GPS, apparel, training aids, accessories). No
  "clubs" category. Variant attributes are a free-form map (hand, size, flex,
  loft, colourway, material, compression, pack size).
- **No foreign keys.** Embed where the child has no independent lifecycle
  (`OrderItem` in `Order`), reference where it's queried on its own
  (`Product → Category`). Cascades are enforced in command handlers, not by
  the database.
- **`forbidNonWhitelisted: true`** on the API — a payload property that isn't
  on the DTO is a `400`, not a silent strip.

---

## Testing

```bash
cd backend  && npm test    # Jest — integration tests on a real replica set (mongodb-memory-server)
cd frontend && npm test    # Vitest unit tests
```

Backend coverage is concentrated on the highest-risk mechanics (outbox relay,
order state machine, cart/coupon rules, auth token rotation, RBAC). There is no
end-to-end suite on either side yet.
