# Gridline web

The website and the dashboard: the public marketing site, the documentation, and the signed-in app where people upload files,
read reports, clean and compare versions, ask questions of a file, and manage their company, billing and integrations.

Next.js 16 (App Router), React 19 with the React Compiler, Tailwind CSS 4, Radix UI primitives, Recharts, Socket.IO client.
The API it talks to is in [`../backend`](../backend); the whole project is described in [`../README.md`](../README.md).

> This is a recent Next.js with breaking changes. Before writing Next-specific code, read the relevant guide in
> `node_modules/next/dist/docs/` (see [`AGENTS.md`](./AGENTS.md)).

## Run it

You need Node.js 24 and the API running on port 4000 (see the backend README).

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:3000
```

In `.env`, for local development without Docker, point the site at the API:

```
API_ORIGIN=http://localhost:4000
NEXT_PUBLIC_REALTIME_URL=http://localhost:4000
NEXT_PUBLIC_API_REFERENCE_URL=http://localhost:4000/reference
```

| Variable | Meaning |
|---|---|
| `API_ORIGIN` | Where the **server side** of this app reaches the API. In Docker it is `http://api:4000` (the default in `.env.example`). Never used by the browser. |
| `NEXT_PUBLIC_REALTIME_URL` | Where the browser opens its live (Socket.IO) connection. Unset behind Caddy, where the site's own address is right. |
| `NEXT_PUBLIC_API_REFERENCE_URL` | Where the "API reference" links point. Unset behind Caddy (`/reference`). |
| `NEXT_PUBLIC_APP_NAME` | The product name in a few places. |

No Stripe key is needed here: payments use Stripe's hosted Checkout, reached by a redirect.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build (a standalone server bundle) and run it |
| `npm run lint` | Biome check (lint and formatting) |
| `npm run format` | Biome format, writing files |
| `npx tsc --noEmit` | Type check |
| `npm run api:types` | Regenerate `src/lib/api/schema.d.ts` from the backend's `docs/openapi.yaml` |
| `node ../design/build-tokens.mjs` | Regenerate the CSS design tokens from `../design/tokens.json` (`--check` verifies them and the contrast pairs) |

After the API changes a route or a response, run `npm run docs:generate` in the backend and then `npm run api:types` here, and
fix whatever the type checker now reports.

## How it is built

### The browser never calls the API directly

Sign-in goes through route handlers under `src/app/session/`. They exchange the API's tokens for **httpOnly cookies**, so
JavaScript in the page never sees a token. Server components read the session with `src/lib/session/` and call the API with a
typed client (`openapi-fetch` over the generated `schema.d.ts`). Client components that need to change something call
`callApi()` (`src/lib/api/call.ts`), which goes to this site's own `/session/api/*` door; that attaches the session, renews it
once if it expired, and forwards to the API. `src/proxy.ts` (Next's request proxy, formerly middleware) protects the signed-in routes: it sends a signed-out visitor to sign in and renews an expired access token before the page renders.

### Where things are

```
src/
  app/
    (marketing)/    home, features, pricing, compare, security
    (auth)/         sign in, register, activate, reset password, accept an invitation
    (onboarding)/   choosing a plan
    (app)/          the signed-in app: dashboard, files, quality rules, notifications, people, billing,
                    analytics, audit, developers (API keys, webhooks), settings
    (docs)/         the documentation (/docs)
    session/        the cookie session and the API passthrough
    kit/            the design-system kit page
  features/         what each part of the app does: its components, queries and rules, one folder per area
    file-detail/    report, preview, versions, comments, the row comparison
    clean/          the Clean builder
    explore/        the query builder and "ask in words"
    files/          the list, filters and upload
  components/       ui/ (buttons, fields, stamps…), app/ (shell, sidebar), marketing/, docs/, brand/, motion/
  lib/              the API client, session, formatting, realtime, the documentation content (lib/docs/content)
  styles/tokens.css generated from ../design/tokens.json: do not edit by hand
```

A page in `app/` fetches on the server and passes plain data to components in `features/`. Components that need state or
effects are marked `"use client"`.

### Design

The look is one design language kept as data in `../design/tokens.json` (light and dark colors, type, spacing, motion, chart
colors) and generated into `src/styles/tokens.css`, the same source the emails and the API reference use. Tailwind 4 is
CSS-first: the tokens are CSS variables and utilities read them. Status is always a "stamp" with an icon and a word, never color
alone. Charts use the three chart colors that were checked for contrast and color-blind safety in both themes. Motion respects
`prefers-reduced-motion`. The theme (light, dark, system) is stored in `localStorage` and applied before first paint by a small
inline script in `app/layout.tsx`. See `/kit` in development for the components.

### Realtime

`src/lib/realtime/live.ts` opens one Socket.IO connection with the access token. It keeps report status, quota meters,
notifications, comments and who is viewing a file up to date without polling. The token for the socket comes from
`/session/socket-token`, so it is never readable from the page's own cookies.

### The documentation

The guides under `/docs` are written as typed blocks in `src/lib/docs/content/` (not MDX files), registered in
`src/lib/docs/registry.ts`. Each guide is one exported array of blocks (`p`, `h2`, `steps`, `table`, `note`, `endpoint`…), so
adding a page is adding a file and one registry entry. Prices and limits are never typed into copy: the pricing page and the
plan table read the plan catalog from the API.

### Conventions

- Types come from the OpenAPI contract. No type assertions (`as Type`) and no `any`: narrow with type guards.
- The React Compiler is on, so do not write `useMemo`, `useCallback` or `memo`.
- Biome is the linter and formatter. `npm run lint` must be clean.
- Every interactive element is reachable and labelled by keyboard and screen reader, and pages are checked at phone width and
  in dark mode.

## Docker

`Dockerfile` builds the standalone server (`output: "standalone"`) and runs it as an unprivileged user on port 3000. It is run by
the compose file at the repository root, behind Caddy. See [`../DEPLOYMENT.md`](../DEPLOYMENT.md) for putting it on a server.
