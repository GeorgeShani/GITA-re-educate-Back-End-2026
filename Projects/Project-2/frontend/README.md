# 3legant Golf — Storefront

Angular 22 (SSR) storefront, account, blog, AI shopping assistant, and staff
admin panel for a golf e-commerce platform. Built against a real live backend
throughout, never mock fixtures.

See the [repo root README](../README.md) for the project overview and the
combined quick start. This file covers running and working on the frontend
itself.

The **design system is `src/styles/_tokens.scss`** — the single source for
colour, spacing, radii, shadows, z-index, and motion. Component styles
reference the custom properties; they never hardcode a value that has a token.
Type scale is `_typography.scss`, breakpoints `_breakpoints.scss`.

---

## Status

Every feature area is built and running: storefront, `/search`, cart and
checkout, the account area, the blog, the AI assistant, and the 19-area admin
panel. A UI-consistency and polish pass has since gone over the whole surface
(status-colour system, shared field/button treatments, broken-layout fixes,
responsive fixes) — a deeper per-page visual-fidelity pass against the Figma
reference is still open. Everything described below is real, running code.

---

## Architecture in one paragraph

One Angular app, three chrome states. The storefront (`site-header` /
`site-footer` / `notification-bar` / the assistant FAB) renders on every route
except `/admin/**`, where `app.ts` hides it in favor of `admin-shell.ts`'s own
sidebar — derived reactively from `router.events`, not a route-data flag, so
it can't drift out of sync with `app.routes.ts`. Every route is lazy
(`loadComponent`), and `app.routes.server.ts` picks a render mode per route:
`Prerender` for static content, `Server` for anything SEO-critical that
changes server-side, `Client` for anything session-scoped (cart, account,
checkout, the whole `/admin/**` subtree) where there's nothing meaningful to
render without the user's token. The dev server proxies `/api` to the backend
same-origin (`proxy.conf.json`, auto-wired via `angular.json`'s `serve`
target) — this isn't optional: the guest cart rides a signed `httpOnly`
cookie, and a cross-origin request silently drops it.

```
Browser ── ng serve (4200) ──/api proxy──> NestJS API (4000)
                │
                ├─ storefront chrome (all routes except /admin/**)
                ├─ admin-shell (role-gated, /admin/**, own sidebar)
                └─ assistant-panel (FAB, global chrome, SSE over POST)
```

**Layout:** `src/app/core/` holds API clients, DTOs, guards, and every
service. `src/app/shared/ui/` is the design-system primitive layer (buttons,
fields, cards, dialogs, tables) — every feature composes these, nothing
duplicates them. `src/app/features/` is one folder per route area; `admin/`
alone has 19 CRUD surfaces built on a small shared layer
(`features/admin/ui/`: page-toolbar, data-table, drawer-form, filter-bar,
empty-state, admin-confirm) rather than one bespoke layout per area.

---

## Quick start

The backend must be running first — see
[`../backend/README.md`](../backend/README.md). This app talks to it through
the dev proxy, never directly.

```bash
npm install
npm start
```

`npm start` is `ng serve` with the `/api` proxy already wired
(`proxy.conf.json` → `http://localhost:4000`). There is no frontend `.env` —
Angular has none; the one value this app needs (Stripe's *publishable* key,
safe to ship in a client bundle by design) already lives in
`src/environments/environment.ts`. See
[`docs/ENV_SECRETS_GUIDE.md`](./docs/ENV_SECRETS_GUIDE.md) if that ever needs
changing.

- App: `http://localhost:4200`
- Admin panel: `http://localhost:4200/admin` (needs a staff role — see the
  backend README's `promote-admin` script; the nav filters itself to what
  the signed-in role can actually reach)
- Style guide: `http://localhost:4200/styleguide` (dev-only, gated by
  `devOnlyGuard`)

---

## Scripts

| Command | What it does |
|---|---|
| `npm start` | `ng serve` with the API proxy wired |
| `npm run build` | Production build to `dist/3legant/` |
| `npm run watch` | Dev-configuration build in watch mode, no server |
| `npm test` | Unit tests via Vitest (`ng test`) |
| `npm run serve:ssr:3legant` | Run the built SSR server (`node dist/3legant/server/server.mjs`) |
| `npm run icons` | Regenerate `shared/ui/icon-sprite.ts` from Lucide — **never hand-edit that file**, it has a do-not-edit-by-hand header |

---

## Things that will bite you

Collected because each one has already cost a debugging session.

**The dev proxy target is hardcoded to port 4000, not 3000.** The backend's
own `.env.example` briefly drifted to `PORT=3000` after a mid-project port
change and broke this silently on a fresh clone — SSR's `apiOrigin` fallback
in `app.config.server.ts` and `proxy.conf.json`'s `target` both assume 4000.
If the backend is listening somewhere else, both need updating together, not
just one.

**Editing `proxy.conf.json` while `ng serve` is already running does
nothing.** The dev-server proxy config loads once at server startup and does
not hot-reload — restart the server after changing it.

**CMS pages live at the root** (`/about`, `/faq`, `/privacy`, …), matched by a
single-segment `:slug` route that sits second-to-last in `app.routes.ts`. It
must stay there — a `:slug` route above any real route shadows it — and a new
CMS page whose slug collides with a real route (`shop`, `cart`, `admin`, …)
will never be reachable. An unresolved slug 404s from the API and the
component renders the real not-found page.

**Reading a resource's `.value()` while it's in its error state throws**
(`ResourceValueError`) and takes the render down with it. Guard template-side
reads that run regardless of the loading/error branch with `.hasValue()` —
`shop`, `search`, and `product-detail` all do.

**`withViewTransitions()` (app-wide routing) can abort specific
post-mutation navigations** — seen after a successful Stripe payment and
after a reorder — leaving the router silently stuck on the old URL with no
error. Both known spots use the same fallback:
`router.navigateByUrl(...).then(succeeded => { if (!succeeded) window.location.href = ... })`.
Apply the same pattern if a third one turns up rather than debugging view
transitions directly.

**An embedded Mongoose subdocument may serialize `_id`, not the app's usual
`id`** — depends on whether *that specific* subdocument's own schema uses
`baseSchemaOptions`, independent of its parent document. Confirmed on order
items, product images, product variants, and return items so far (all typed
`_id: string` in `core/api/dto.ts` for exactly this reason). Before typing a
DTO for any new embedded subdocument, curl a real API response rather than
assuming the top-level "everything is `id`" convention extends inward.

**Angular's build does not flag an unused pipe import** the way it does an
unused component/directive (which is a real `NG8113` error). A clean
`ng build` is not proof every pipe in a component's `imports` array is
actually used in its template — check by grepping for the pipe's usage
syntax (`| money`, `| date`), not the class name (which trivially appears
in the `import` statement and the `imports` array regardless).

**Signal Forms (`@angular/forms/signals`) are only used in `features/auth/`**
so far. Everywhere else — including every admin form — plain signals +
`(valueChange)` on the `TextField`/`SelectField`/etc. primitives do the job,
because those primitives use `input()`/`output()`, not the `model()` a
Signal Forms `[formField]` binding needs. Don't assume Signal Forms is the
house style project-wide; check what the nearest sibling component actually
does.

**Apply the `reveal` directive** (`shared/directives/reveal.directive.ts`)
to every visible section on a new storefront page, except the header and
footer. This is a standing convention, not a suggestion — it existed unused
in the codebase for a long stretch before this rule was set. It does **not**
apply to `/admin/**` — that's a staff-only internal surface with its own,
simpler chrome.

**The AI assistant is a floating action button, not a header icon** —
`assistant-panel.ts` renders its own `position: fixed` FAB bottom-right,
mounted globally in `app.ts` (hidden on `/admin/**` along with the rest of
storefront chrome). Its SSE calls go over `POST` through a hand-rolled
`fetch` + `ReadableStream` parser (`core/api/sse-client.ts`) — the browser
`EventSource` API is GET-only and can't carry the `Authorization` header
this endpoint needs.

---

## Known gaps

Recorded so they read as decisions rather than surprises.

- **A deeper visual-fidelity pass against the Figma reference is still open.**
  A cross-cutting consistency/polish pass has been done (broken layouts,
  status colours, shared field/button treatments, responsive fixes); matching
  each page pixel-for-pixel to the Figma comps and adding the intended
  animation is the remaining work.
- **Saved payment methods aren't wired into checkout.** The backend's
  `PlaceOrderDto` has no `paymentMethodId` yet (see the backend README's
  Known gaps), so `account-payment-methods` is management-only — every
  checkout still collects fresh card details.
- **Product-card "add to wishlist" only exists inside `/account/wishlist`.**
  Adding directly from `/shop` or product-detail isn't built — the shared
  `ProductCardProduct` shape has no product id field yet to hang the action
  off.
- **A pre-existing `NG0203` console warning fires on a cold direct-URL load
  of almost any route** (reproduced on plain `/shop`, untouched code) — page
  content still renders correctly through it, the error is silently
  swallowed somewhere in the render path. Not yet root-caused; worth a
  dedicated investigation session.
- **No end-to-end test suite.** Unit tests run via Vitest; there is
  currently no Playwright/Cypress equivalent to the backend's integration
  suite. `ng e2e` has no framework configured.
