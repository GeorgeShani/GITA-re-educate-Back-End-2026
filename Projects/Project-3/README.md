# Gridline

Where a company's spreadsheets live. Upload a CSV or XLSX file and Gridline checks it on arrival, finds the personal data in
it, holds it to the company's own rules, cleans it into a new version if you ask, shows which rows changed between versions,
and answers questions about it. Access is per person, every change is audited, and billing is by seat and volume.

This is a multi-tenant SaaS: a NestJS API, a Next.js dashboard and marketing site, and the Docker setup that runs them as
one app.

## What it does

| | |
|---|---|
| **Quality report** | Row and column counts, empty cells, the type each column really holds, duplicates, a 0–100 score and an optional plain-language summary. The model only ever sees aggregates, never a cell. |
| **Personal-data scan** | Columns that look like emails, phone numbers, card numbers, IBANs, IP addresses, birth dates or secret keys, found by patterns and checksums (never by AI), with a warning when such a file is open to the whole company. |
| **Rules** | A company's own checks (a required column, a limit on empty cells, no personal data…) applied to every upload. |
| **Clean** | A recipe of small steps (trim, de-duplicate, dates, numbers, placeholders, hide personal data), previewed over the whole file and written as the next version. The upload is never touched. |
| **Versions and row changes** | Each upload is the next version. Two versions are compared by statistics, and, with key columns, row by row: added, removed, changed, with a CSV of every change. |
| **Explore and ask** | Group, count and total every row with a query builder, or ask in words. The assistant is shown only the question and the column names and types. |
| **Access** | A file is open to the company or to named people. Anyone else gets "not found", never "access denied". |
| **Collaboration** | Comments with mentions, who is looking at a file right now, an inbox, and live status over WebSockets. |
| **Billing** | Free, Basic and Premium plans; Stripe Checkout, metered usage, invoices, dunning. |
| **Audit** | An append-only log of every change. |
| **For developers** | Scoped API keys, signed outgoing webhooks, a read-only GraphQL API, an OpenAPI reference and an MCP server so an AI agent can work with files. |

The full description of the product is in [`PRODUCT.md`](./PRODUCT.md) and the design and requirements in
[`SCOPE.md`](./SCOPE.md).

## How it is put together

```
                Browser
                   │  one origin, HTTPS
                   ▼
        ┌─────────────────────┐
        │  Caddy  (proxy/)    │   /api/*  /socket.io  /reference  /graphql ──┐
        └─────────┬───────────┘                                               │
                  │ everything else                                           ▼
                  ▼                                                ┌────────────────────┐
        ┌─────────────────────┐   server-side calls                │  API  (backend/)   │
        │  Web  (frontend/)   │ ─────────────────────────────────▶ │  NestJS, port 4000 │
        │  Next.js, port 3000 │                                    └───┬────┬────┬──────┘
        └─────────────────────┘                                        │    │    │
                                                          Postgres (Neon)  S3   Stripe, SMTP, AI
```

- **`backend/`** is the API: NestJS 12, TypeORM, Postgres on Neon, a durable task queue inside Postgres, Socket.IO, GraphQL and
  an MCP endpoint.
- **`frontend/`** is the website and the dashboard: Next.js 16, React 19, Tailwind 4. The browser never talks to the API
  directly. Next.js keeps the session in an httpOnly cookie and forwards calls (the "backend for frontend" pattern).
- **`proxy/`** is Caddy. It puts both on one origin, so there is no CORS to configure, and it gets the HTTPS certificate.
- **`design/`** is the design language (colors, type, motion) as data. A script generates the CSS tokens from it.

Some rules hold everywhere, and the code enforces them:
- A company is the tenant. Every query is scoped to it, and the company comes from the signed-in person's own record, never
  from the request.
- One access rule decides who can see a file. A file you cannot see is a 404.
- The AI never receives a cell value.
- Plans live in one place, `backend/src/subscriptions/plan-catalog.ts`, and the website reads them from the API.

## Run it on your computer

You need **Node.js 24** and a Postgres database. The easiest is a free [Neon](https://neon.tech) project; a local one works
too (`docker compose --profile dev up db`).

```bash
# 1. The API
cd backend
npm install
cp .env.example .env          # fill in DATABASE_URL and DIRECT_URL, and set STORAGE_DRIVER=local (see below)
npm run build
npm run migration:run
npm run seed:all              # a demo company and a sign-in-able test company
npm run dev                   # http://localhost:4000

# 2. The website (in another terminal)
cd frontend
npm install
cp .env.example .env          # for local development set API_ORIGIN=http://localhost:4000 and
                              # NEXT_PUBLIC_REALTIME_URL=http://localhost:4000
npm run dev                   # http://localhost:3000
```

Then open <http://localhost:3000> and press **Explore the demo**, or sign in as `admin@fixture.gridline.test` with the password
`Fixture-Password-1!`. With `STORAGE_DRIVER=local` files are stored in a folder on disk, and the other defaults are already the offline ones: email
is printed to the log, payments are simulated (`PAYMENTS_PROVIDER=none`) and the AI summary is off. So you need no AWS, SMTP,
Stripe or Gemini account to try everything except the AI features and real payments.

The API reference is at <http://localhost:4000/reference>.

### Everything in Docker

```bash
docker compose --profile dev up --build      # local Postgres + migrate + api + web + proxy, on http://localhost:3000
```

Without the `dev` profile, `DATABASE_URL` and `DIRECT_URL` must point at Neon.

## Checking your work

```bash
# backend
cd backend
npm run lint && npm test                    # lint and unit tests (no database needed)
npm run test:int                            # integration tests: needs a reachable DATABASE_URL
npm run docs:check                          # the committed OpenAPI file is up to date

# frontend
cd frontend
npm run lint && npx tsc --noEmit            # Biome and the type checker
node ../design/build-tokens.mjs --check     # design tokens and contrast
```

The integration tests **empty the database they run against**. Never point them at data you want to keep, and run one suite at a
time against a shared database. GitHub Actions (`.github/workflows/project-3.yml`) runs all of this on every push.

After changing an API route, regenerate the contract and the frontend's types:

```bash
cd backend  && npm run docs:generate        # writes docs/openapi.yaml
cd ../frontend && npm run api:types         # writes src/lib/api/schema.d.ts
```

## Deploying

`DEPLOYMENT.md` is the guide for putting the whole app on one server: [`DEPLOYMENT.md`](./DEPLOYMENT.md). It covers EC2, a free or
cheap domain, HTTPS, the Stripe webhook and its secret, and the production environment. Setting up Stripe from nothing, one value at
a time, is in [`backend/docs/STRIPE_SETUP.md`](./backend/docs/STRIPE_SETUP.md).

## Where things are

| Path | What is there |
|---|---|
| [`backend/README.md`](./backend/README.md) | The API: setup, database, configuration, seed data, how each part behaves |
| [`backend/docs/OVERVIEW.md`](./backend/docs/OVERVIEW.md) | Every feature of the API and why it exists |
| [`backend/docs/ENV_SECRETS_GUIDE.md`](./backend/docs/ENV_SECRETS_GUIDE.md) | Every environment variable |
| [`backend/AGENTS.md`](./backend/AGENTS.md) | Coding conventions, for people and for AI assistants |
| [`frontend/README.md`](./frontend/README.md) | The website and dashboard |
| [`design/`](./design) | Design tokens, brand assets, motion notes |
| [`proxy/Caddyfile`](./proxy/Caddyfile) | Routing between the website and the API |
| [`docker-compose.yml`](./docker-compose.yml), [`docker-compose.prod.yml`](./docker-compose.prod.yml) | Running everything, and the production layer |
| [`SCOPE.md`](./SCOPE.md), [`PRODUCT.md`](./PRODUCT.md) | What was asked for, and the product as built |

## Known limits

Stated plainly, as in the product:
- Realtime updates and rate-limit counters live in one API process. That is right for one server; several servers need a shared
  store first.
- There is no self-service company deletion or data export yet.
- Legacy `.xls` files are stored and downloadable but not profiled.
- Reports, cleaning, row comparison and Explore cover up to 100,000 rows and 200 columns of one sheet.
- Personal-data detection is by pattern, so names and addresses written as free text are not recognised.
- Deployments are manual. There is no pipeline that ships to a server yet.
