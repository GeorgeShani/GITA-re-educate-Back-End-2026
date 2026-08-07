# 3legant Golf — Project Scope

**A full-stack e-commerce platform for a Golf Accessories retailer.**
Angular 22 (SSR) · NestJS 11 · Neon Postgres · Event-driven architecture · AI shopping assistant

This document is the single source of truth for the project: the complete design system extracted from Figma, the architecture, and the build plan. Keep it current — if a decision changes, it changes here first.

**Design source:** 3legant template — Figma file `MyEANVJ5LM3xkiRHsv7yk4`, page `🪴 Templates` (node `3:674`). 23 screens in desktop + mobile pairs, 92 distinct component instances. All template copy, categories, and product attributes are replaced with golf equivalents.

**Scope reality:** this is a large product being built solo. Phases 1–5 are the MVP — a store that can actually take money. Phases 6–7 are the admin and content surfaces. Phases 8–10 are the differentiators. Nothing here is optional to *plan*; the ordering is what protects the deadline.

---

# Part A — Design System

## A1. Font families

| Family | Weights used | Role | Install |
|---|---|---|---|
| **Poppins** | 400, 500, 600 | All headings, plus a few captions | `@fontsource/poppins` — **static**, not `-variable` |
| **Inter** | 400, 500, 600, 700 | Body, UI, buttons, captions, form controls | `@fontsource-variable/inter` |
| ~~Space Grotesk~~ | 500 | Appears in exactly one unused token (`Button/XSmall`) | **Do not ship** |

Self-host via npm packages, not Google Fonts `<link>` tags.

> ⚠️ **Poppins has no variable-font build.** `@fontsource-variable/poppins` does not exist on npm — Google's Poppins distribution ships static weights only. Install `@fontsource/poppins` and import the three weight files actually used (`400.css`, `500.css`, `600.css`); the family name in CSS is `'Poppins'`, with no "Variable" suffix. Inter *does* have a variable build — `@fontsource-variable/inter`, family name `'Inter Variable'` — so the two fonts are installed differently. Don't assume both follow the Project-1 pattern.
>
> **No `<link rel="preload">` in `index.html`.** These fonts are pulled into `styles.scss` via Sass `@use`, so the build tool content-hashes the emitted `.woff2` filenames on every compile — a static preload href would go stale the moment the hash changes and 404 silently. Rely on `font-display: swap` instead (fontsource's default), which avoids invisible text during load at the cost of a brief flash of fallback-font text. If first-paint font latency ever becomes a measured problem, revisit by copying specific font files into `public/` under stable names — that's a different asset strategy than self-hosting via the npm packages, so treat it as a deliberate trade-off, not a small tweak.

```scss
--font-poppins: 'Poppins', ui-sans-serif, system-ui, sans-serif;
--font-inter:   'Inter Variable', ui-sans-serif, system-ui, sans-serif;
```

## A2. Type scale

Every value read directly from Figma variables. Implement as SCSS mixins in `_typography.scss` so no component repeats a font declaration.

| Token | Family | Weight | Size | Line height | Tracking |
|---|---|---|---|---|---|
| `headline-2` | Poppins | 500 | 72 | 76 | -2 |
| `headline-3` | Poppins | 500 | 54 | 58 | -1 |
| `headline-4` | Poppins | 500 | 40 | 44 | -0.4 |
| `headline-5` | Poppins | 500 | 34 | 38 | -0.6 |
| `headline-6` | Poppins | 500 | 28 | 34 | -0.6 |
| `headline-7` | Poppins | 500 | 20 | 28 | 0 |
| `body-1` | Inter | 400 | 20 | 32 | 0 |
| `body-1-semi` | Inter | 600 | 20 | 32 | 0 |
| `body-2` | Inter | 400 | 16 | 26 | 0 |
| `body-2-semi` | Inter | 600 | 16 | 26 | 0 |
| `body-2-bold` | Poppins | 500 | 16 | 24 | 0 |
| `caption` | Poppins | 400 | 14 | 24 | 0 |
| `caption-1` | Inter | 400 | 14 | 22 | 0 |
| `caption-1-semi` | Inter | 600 | 14 | 22 | 0 |
| `caption-2` | Inter | 400 | 12 | 20 | 0 |
| `caption-2-semi` | Inter | 600 | 12 | 20 | 0 |
| `caption-2-bold` | Poppins | 600 | 12 | 20 | 0 |
| `button-m` | Inter | 500 | 18 | 32 | -0.4 |
| `button-s` | Inter | 500 | 16 | 28 | -0.4 |
| `button-xs` | Inter | 500 | 14 | 24 | 0 |
| `hairline-1` | Inter | 700 | 16 | 16 | 0 |
| `hairline-2` | Inter | 700 | 12 | 12 | 0 |

### Template inconsistencies — normalise, don't replicate

Recorded here so nobody "fixes" them back later:

- **`Body 2 (Bold)` is Poppins Medium 500**, not Inter Bold, despite the name.
- **`Caption 2` resolves to Inter on some frames and Poppins on others.** Standardise on Inter 400 12/20.
- **The `Text/*px/*` family duplicates the scale.** `Text/12px/Semibold`, `Text/14px/Semibold`, `Text/16px/Regular`, `Text/16px/Semibold`, `Text/18px/Regular`, `Text/18px/Semibold` come from a different library and map exactly onto the Caption/Body tokens above. Collapse them.
- **`Headline 1` is not bound anywhere** in the file. Anything above 72px is our own definition.

## A3. Colour

### Primary neutral ramp — use this one everywhere

| Token | Hex | Role |
|---|---|---|
| `--color-neutral-01` | `#FEFEFE` | Page background, text on dark |
| `--color-neutral-02` | `#F3F5F7` | Surface, card fill, image placeholder background |
| `--color-neutral-03` | `#E8ECEF` | Borders, dividers |
| `--color-neutral-04` | `#6C7275` | Secondary text, form borders, default icon. Also used at 50% and 25% alpha |
| `--color-neutral-05` | `#343839` | Body text |
| `--color-neutral-06` | `#232627` | Dark surfaces |
| `--color-neutral-07` | `#141718` | Primary text, primary button fill |

### Accents

| Token | Hex | Where it appears |
|---|---|---|
| `--color-success` | `#38CB89` | "In stock", order confirmed, **and the sale/discount badge** |
| `--color-info` | `#377DFF` | Links, active states (Figma: `Blue`) |
| `--color-white` | `#FFFFFF` | |
| `--color-brand` | `#000000` | Logo (Figma: `Brand color`) |

`Primary/4 #45B26B` appears on the Order Complete screen only — a second green from another library. Collapse it into `--color-success`.

### Aliased leftovers — two ramps that are load-bearing

Two additional ramps are bound from imported libraries. Map every occurrence onto the Neutral ramp rather than shipping three greys — **except** the two below, which are genuinely used in component specs and get semantic aliases instead:

```scss
--color-border-input: #CBCBCB;  /* Black/300 — text input border */
--color-price:        #121212;  /* Black/900 — price text */
```

Everything else in these ramps is unused and must not be introduced:

- `Black/100 #F5F5F5` · `Black/200 #EAEAEA` · `Black/500 #807E7E` · `Black/600 #605F5F`
- `Neutrals/2 #23262F` · `Neutrals/3 #353945` · `Neutrals/4 #FFFFFF` · `Neutrals/5 #B1B5C3` · `Neutrals/8 #FCFCFD` · `Neutrals/White #FFFFFF`
- `Transparent` is bound to `#FFFFFF` — mislabelled, ignore.

### ⚠️ There is no red in this design system

Verified by inspecting the badge component directly: **the discount badge is green** (`#38CB89` background, `#FEFEFE` text) and the "NEW" badge is white on `#121212`. No error, warning, or destructive colour is bound anywhere in the file.

Checkout validation, admin destructive actions, and failed-payment states all need one, so we **define our own semantic set**. These are additions, not extractions:

```scss
--color-error:   #E5484D;  /* form validation, failed payment, destructive */
--color-warning: #F5A524;  /* low stock, pending states */
--color-info:    #377DFF;  /* from the design */
--color-success: #38CB89;  /* from the design */
```

Validate each against `--color-neutral-01` for WCAG AA contrast before locking.

## A4. Radii, borders, spacing, effects

Radius scale — measured off the real components:

| Token | Value | Used by |
|---|---|---|
| `--radius-sm` | `4px` | Badges, checkbox/radio, quantity stepper |
| `--radius-md` | `6px` | Text inputs, textareas |
| `--radius-lg` | `8px` | Buttons, dropdowns |
| `--radius-full` | `100px` | Icon buttons, pills, avatars |

**Border widths:** `1px` (inputs, quantity stepper) · `1.5px` (checkbox/radio) · `2px` (dropdown). Default border colour `--color-neutral-04`, except text inputs which use `--color-border-input`.

**Spacing** is a 4px base scale. Observed values: 4, 6, 8, 12, 14, 16, 24, 32, 40 → define `--space-1` (4px) through `--space-10` (40px).

**Effects:**

```scss
--shadow-01:      0 8px 16px rgba(0, 0, 0, 0.035);       /* Figma: Shadow/01, #00000009 */
--shadow-depth-1: 0 8px 16px -8px rgba(15, 15, 15, 0.2); /* Figma: depth/1, #0F0F0F33 */
```

**Layout:** mobile frames are **375px**, desktop **1440px**. **No tablet frame exists in the template** — `--breakpoint-tablet: 768px` is our own design tier.

## A5. Component specs (measured)

| Component | Size | Padding | Radius | Border | Fill | Type |
|---|---|---|---|---|---|---|
| Button (primary) | h40 | `6px 40px` | 8 | — | `--color-neutral-07` | `button-s` |
| Button heights in file | 24, 26, 32, 36, 40, 48, 52, 56 | — | 8 | — | — | `button-m/s/xs` by size |
| Icon button | 32 (24 icon + 4 pad) | `4px` | full | — | transparent | — |
| Badge | auto × 24 | `4px 14px` | 4 | — | `--color-success` (sale) / white (new) | `hairline-1`, uppercase |
| Text input | h40 (also 48, 52) | `0 16px` | 6 | 1px `--color-border-input` | white | `body-2`; placeholder `--color-neutral-04` |
| Textarea | h140 | `0 16px` | 6 | 1px `--color-border-input` | white | `body-2` |
| Dropdown | h48 | `8px 8px 8px 16px` | 8 | 2px `--color-neutral-04` | transparent | `body-2-semi`, 24px chevron |
| Checkbox / radio | 24 × 24 | — | 4 | 1.5px `--color-neutral-04` | `#FCFCFD` | label `caption-1-semi` |
| Quantity stepper | 80 × 32 | `12px 8px` | 4 | 1px `--color-neutral-04` | transparent | `caption-2-semi`, 16px icons |
| Notification bar | 1440 × 40 / 375 × 36 | — | — | — | dark | `caption-1` |
| Navigation bar | 1440 × 60 | — | — | — | — | — |
| Icon (standard) | 24 × 24 | — | — | — | — | — |
| Star (rating) | 16 × 16; group 88 × 16 | — | — | — | — | — |

### Product Card

262 × 433 desktop · 231 × 392 mobile · 231 × 412 on Homepage 04.

- Image area 262 × 349 on `--color-neutral-02`, with `mix-blend-multiply` on the product image
- Badge stack inset 16px from top-left, 8px gap between badges
- Content block starts 12px below the image; internal gap 4px
- Order: rating group (88 × 16) → title `body-2-semi` `--color-neutral-07` → price row with 12px gap
- Price: current `caption-1-semi` `--color-price`; original `caption-1` strikethrough `--color-neutral-04`

## A6. Component inventory

**Primitives** — `Button` (55 uses), `Checkbox` (6), `ratio button` (6), `dropdown` (15) + `dropdown_list` (2), `Quantity Button small` (5), `Swatches/Single/Image` (16), `Rating/Rating Group` (61) + `start rating` (10), `Navigation Dots` (6), `Breadcrumbs/Link Group` (11), `Tabs/Menu`, `Badge medium`.

**Icon set (~30, line style, 24 × 24)** — arrow-right (46), close (18) + `icons/Close/Line` (10), chevron-right (8), chevron-down (2), email (12), heart, eye (3), filter, menu-line-horizontal (18), lock, call (6), mail (2), store (2), user-circle (2), calendar (2), location (2), money (4), fast-delivery (4), edit (4), smile, instagram / facebook / youtube (3 each), arrows/direction-right (3), couple-arrows (2).

**Composites** — `Product Card` (52), `Elements/Card` (31) + `Elements/Card (mobile)` (32), `Cart/Product Cell (Mobile)` (9) + `Elements/Cart/Product Cell` (3), `Elements/Order Summary/Info Field` (8), `Order Summary/Coupon Field`, `Elements/Cart/Summary` + `(Mobile)`, `Elements/Checkout/Order Summary`, `Elements/Menu/Avatar Edit` (8), `Elements/Filter Section/Title` (2), `Elements/Toolbar Selector Buttons` (22), `Image Placeholder` (56) + `header` (4) + `blog` (3), `Timer` (8), `Process` (6), `Payment Methods` (18), `ticket-percent` (18), `Elements/Product Loop/Meta` (4), `Elements/Navigation/Cart Button` (19).

**Layout / sections** — `Navigation Bar` (19), `Notification Bar` (8), `Footer` (16) + `Footer (mobile)` (17), `Page Header` (3), `Newsletter` (7), `Values` (3), `Banner`, `Banner Grid`, `Blog Section` (2), `Product Carousel`, `Slider Section`, `Instagram/Elements/Image` (28), `Small Cards`, `team logo/logo 01–06` (4 each), `Product Page/Slider/Featured Image` (3) + `Elements/Slider Area/Arrows` + `Thumbnail Images`, `Fly menu (mobile)`, `Emoji popup`.

**Not in Figma — design on these tokens:** the entire admin surface. Data tables, filter bars, stat tiles, charts, form layouts, drawers, toasts, confirm dialogs, file dropzone, rich-text editor chrome, order status board.

## A7. Screen inventory

| Screen | Desktop node | Mobile node |
|---|---|---|
| Homepage 01 | `3:677` | `13:2053` |
| Homepage 02 | `88:10423` | `172:12538` |
| **Homepage 03** ← the one we build | **`116:6824`** | **`176:13558`** |
| Homepage 04 | `150:7552` | `176:14880` |
| Fly menu | — | `170:10649` |
| Sign In Popup | `172:12346` | `172:12496` |
| Sign Up Popup | `171:11483` | `172:12388` |
| Shop Page 01 | `24:389` | `74:8369` |
| Shop Page 02 | `33:6663` | `74:9110` |
| Shop Page 03 | `35:7381` | `74:9497` |
| Product Page 01 | `37:1912` | `72:6739` |
| Product Page 02 | `48:9324` | `74:7800` |
| Flyout Cart | `70:5335` | `72:6176` |
| Cart | `56:5593` | `78:6488` |
| CheckOut | `59:10897` | `80:7851` |
| Order Complete | `61:11644` | `81:8738` |
| My Account | `63:3891` | `83:9236` |
| My Account / Address | `67:4507` | `85:9848` |
| My Account / Orders | `68:4827` | `85:10008` |
| My Account / Wishlist | `70:5110` | `87:10182` |
| Blog 01 | `52:4112` | `75:5268` |
| Blog Post 01 | `54:5208` | `76:5905` |
| Contact Us 01 | `50:2794` | `77:6255` |

**Homepage 03 section order:** Notification Bar → Navigation Bar → Slider Section → Product Carousel → Categories → Banner → Banner Grid → Blog Section → Newsletter → Instagram newsfeed → Footer.

### Asset extraction

Pull icons and imagery with the Figma **`download_assets`** tool, not `get_design_context` — the latter's reconstructed SVGs come out flipped. Every export opens with a `#C3C3C3` background rect plus two boilerplate mask paths; strip all three and verify byte size actually dropped per file (the mask fill colour varies, so a regex can silently miss one). SVGs go into `public/icons/` with a barrel export.

## A8. Golf domain model

**Categories:** gloves · balls · tees · headcovers · towels · bags · rangefinders & GPS · apparel · training aids · accessories

**Variant attributes:** hand (L/R) · size · flex · loft · dexterity · colourway · material · compression (balls) · pack size

**Product fields beyond the basics:** brand, SKU, barcode, weight + dimensions (shipping), care instructions, spec sheet, `isFeatured`, `publishedAt`, SEO title / description / OG image.

---

# Part B — Architecture

## B1. Decisions

| Area | Decision |
|---|---|
| Data layer | **Neon Postgres + TypeORM** with migrations — orders, stock, coupons, and the outbox all need real transactions |
| Backend architecture | **Event-driven** — `@nestjs/cqrs` command/query/event buses + transactional outbox + BullMQ/Redis consumers + sagas |
| Frontend styling | **SCSS + CSS custom properties**, no Tailwind — keeps `inlineStyleLanguage: scss` and the existing Angular config |
| Payments | **Stripe test mode** — PaymentIntents + webhook-confirmed orders, behind a `PaymentProvider` interface |
| Media | **S3 + CloudFront** via AWS SDK v3; image processing is our own `sharp` consumer, not a vendor feature |
| Email | **Resend + MJML/Handlebars** behind a `MailProvider` interface. Every send is event-triggered, logged, idempotent, and suppression-checked — see B4 |
| Environments | **Managed services throughout, no local Docker** |
| AI assistant | **Read + act** — Claude tool-use agent that searches, compares, and mutates the cart, streamed over SSE |

## B2. The event-driven core

### Three mechanisms, one rule

| Mechanism | Package | Use for | Delivery |
|---|---|---|---|
| **CommandBus** | `@nestjs/cqrs` | Every state change. One handler per command | In-process, sync |
| **EventBus** | `@nestjs/cqrs` | Domain facts, past tense. Many handlers per event | In-process, sync |
| **Outbox → BullMQ** | `bullmq` + Redis | Anything slow, retryable, or deferred — email, images, indexing, analytics | Durable, at-least-once |

> **The rule:** never publish to a queue inside a database transaction, and never do side effects inside a command handler.

A command handler writes its entity **and** an `outbox_events` row in one transaction, then returns. A relay picks the row up and publishes it. This is the transactional outbox pattern, and it makes "order placed but no confirmation email" structurally impossible.

```
HTTP/SSE ─▶ Controller ─▶ CommandBus ─▶ Handler ──┐ one DB transaction
                                                   ├─ write entity
                                                   └─ write outbox_events row
                                                        │
                        OutboxRelay (poll ~1s, SKIP LOCKED)
                                                        │
                                                   BullMQ queues
                                          ┌─────────────┼─────────────┐
                                      notifications  media       search
                                      analytics    audit-log   webhooks
```

**`outbox_events`** — `id`, `aggregate_type`, `aggregate_id`, `event_name`, `payload jsonb`, `occurred_at`, `published_at`, `attempts`, `correlation_id`.

The relay uses `SELECT … FOR UPDATE SKIP LOCKED LIMIT 100` so multiple instances never double-publish. Consumers are idempotent, keyed on `event.id`. Poll at ~1s rather than 500ms — Neon's round-trip is higher than a local socket, and the extra latency is invisible to users while halving query volume.

### Domain event catalog

Classes in `src/<domain>/events/`, all extending a `DomainEvent` base carrying `occurredAt` + `correlationId`.

| Aggregate | Events |
|---|---|
| User | `registered`, `email_verified`, `logged_in`, `password_reset_requested`, `password_changed`, `profile_updated`, `deleted` |
| Product | `created`, `updated`, `published`, `unpublished`, `archived`, `price_changed`, `variant_added` |
| Inventory | `reserved`, `reservation_released`, `decremented`, `adjusted`, `low_stock_reached`, `out_of_stock`, `back_in_stock` |
| Cart | `created`, `item_added`, `item_removed`, `item_quantity_changed`, `coupon_applied`, `merged`, `abandoned`, `converted` |
| Order | `placed`, `paid`, `payment_failed`, `confirmed`, `fulfilled`, `shipped`, `delivered`, `cancelled`, `refunded` |
| Payment | `intent_created`, `succeeded`, `failed`, `refund_issued` |
| Return | `requested`, `approved`, `rejected`, `received`, `refunded` |
| Review | `submitted`, `approved`, `rejected`, `replied` |
| Coupon | `redeemed`, `limit_reached`, `expired` |
| Media | `uploaded`, `variants_generated`, `deleted` |
| Content | `post_published`, `post_unpublished`, `page_updated` |
| Marketing | `newsletter_subscribed`, `newsletter_unsubscribed`, `back_in_stock_requested` |
| Wishlist | `item_added`, `item_removed` |
| Email | `queued`, `sent`, `delivered`, `bounced`, `complained`, `failed` — emitted by the mailer and by provider webhooks |

### Consumers

| Queue | Subscribes to | Does |
|---|---|---|
| `notifications` | `user.*`, `order.*`, `return.*`, `review.*`, `inventory.back_in_stock`, `cart.abandoned`, `marketing.*` | Resolves recipient + preferences, checks suppression, renders MJML/Handlebars, sends via `MailProvider`, writes an `EmailMessage` row. See B4 |
| `media` | `media.uploaded`, `media.deleted` | `sharp` variant ladder + blurhash, EXIF strip, derivative cleanup |
| `search` | `product.*`, `inventory.*`, `content.post_published` | Rebuilds the `tsvector` document + facet cache |
| `analytics` | Order, cart, product-view events | Writes rollup tables that feed the admin dashboard |
| `audit-log` | **Every** event (wildcard) | Append-only `audit_log` — powers the admin activity feed |
| `webhooks` | Configurable subset | Outbound HTTP, HMAC-signed, exponential backoff |

### Sagas

`@nestjs/cqrs` `@Saga()` — each a documented state machine, not scattered `if` statements.

1. **Checkout** — `order.placed` → reserve inventory → create PaymentIntent. On `payment.succeeded` → `order.paid` → decrement stock, redeem coupon, `order.confirmed`. On `payment.failed` or a 15-minute reservation timeout → release inventory, `order.cancelled`. **This compensating-transaction path is the centrepiece of the architecture.**
2. **Fulfillment** — `order.confirmed` → admin fulfillment → `order.shipped` (tracking attached) → delayed job → `order.delivered` → schedule review-request email.
3. **Abandoned cart** — `cart.item_added` schedules a delayed job at +24h; `cart.converted` cancels it; otherwise `cart.abandoned` → recovery email with a one-time coupon.
4. **Return** — `return.requested` → approval → `return.received` → Stripe refund → restock → `return.refunded`.

### Cross-cutting

- **`nestjs-cls`** — AsyncLocalStorage request context (`userId`, `correlationId`, role). Every command, event, and outbox row carries the correlation id, so one trace spans HTTP → command → event → queue job → email.
- **`nestjs-pino`** — structured JSON logs keyed on that correlation id.
- **`@nestjs/schedule`** — outbox sweep, abandoned-cart scan, analytics rollups, sitemap regen, expired-reservation cleanup.
- **`@nestjs/terminus`** — health checks for Neon, Redis, Stripe, S3.
- **Read models** — the admin dashboard and storefront facets query denormalised projection tables maintained by consumers, never the write model.

## B3. Hosting

No local Postgres or Redis. Development points at real free-tier infrastructure, so what we test is what we ship.

| Concern | Service | Why |
|---|---|---|
| Postgres | **Neon** | Branching — a branch per environment, a throwaway branch per risky migration |
| Redis | **Railway Redis**, co-located with the backend | BullMQ holds blocking connections (`BRPOPLPUSH`) and polls continuously; per-command serverless Redis pricing burns quota fast. Upstash works if preferred — set `maxRetriesPerRequest: null`, `enableReadyCheck: false` |
| Backend API | **Railway** (Render/Fly equivalent) | Must be a **persistent container** — the outbox relay, BullMQ workers, and SSE streams all need long-lived processes. Vercel/Lambda cannot host this backend |
| Workers | Second Railway service, same image, `ROLE=worker` | API and consumers scale independently; a stuck image job can't stall HTTP traffic |
| Object storage | **S3 + CloudFront** | Private bucket, CDN-fronted, CORS locked to our origins |
| Frontend SSR | **Railway/Render alongside the backend** | `frontend/src/server.ts` is already an Express 5 app — `npm run serve:ssr:3legant` deploys as-is |
| Email | **Resend** | Generous free tier, simple SDK |
| Errors | **Sentry** + Railway logs | |

### Neon gotchas — handle in Phase 1, not on deploy day

1. **Two connection strings.** The app uses the **pooled** host (`…-pooler.…`); **migrations must use the direct host** — PgBouncer in transaction mode breaks the session state DDL and advisory locks rely on. Wrong way round produces migrations that appear to hang.
2. **SSL is mandatory** — `?sslmode=require` plus `ssl: { rejectUnauthorized: true }`.
3. **Scale-to-zero cold starts** — raise `connectTimeoutMS`; don't let a health check read a cold start as an outage. The outbox poll keeps the branch permanently awake; that's the trade for reliable delivery. To let it sleep, switch to `LISTEN/NOTIFY`, which **requires the direct connection**.
4. **Modest pool size** (10–20) — serverless Postgres punishes large idle pools; let the pooler multiplex.
5. **Branches as environments** — `main` = production, `dev` = day-to-day, throwaway branches to rehearse destructive migrations. Copy-on-write, so this is nearly free.

## B4. Email & notifications

Email is a first-class subsystem, not a side effect of the queue. Every message is triggered by a domain event, rendered from a versioned template, delivered through the `notifications` consumer, and logged — so "did the customer actually get their receipt?" is a database query, not a guess.

### Provider abstraction

`MailProvider` interface (`send`, `sendBatch`, `verifyWebhook`) with three implementations, the same pattern as `StorageProvider` and `PaymentProvider`:

| Impl | Used in |
|---|---|
| `ResendProvider` | Production |
| `ConsoleProvider` | Dev default — writes rendered HTML to `dist/mail-out/` and logs the plain-text body. No network calls |
| `NoopProvider` | Tests |

> ⚠️ **Dev safety gate — this is a guard in code, not a convention.** In any non-production environment the mailer rewrites every recipient to `MAIL_DEV_REDIRECT` unless the address is on `MAIL_DEV_ALLOWLIST`. The seed script creates realistic customer accounts; running the notification consumer against those without this gate sends real mail to strangers. Build the gate before the first template.

### Templating

**MJML → compiled HTML at build time, Handlebars for interpolation.** MJML because email clients — Outlook above all — need table-based layouts, and hand-writing those is a losing battle.

- `src/notifications/templates/<name>.mjml` + `<name>.txt.hbs`. **Every email ships an HTML and a plain-text part** — text-only is both a deliverability signal and an accessibility requirement.
- One shared layout carrying the golf brand: logo, `--color-neutral-07` header, a web-safe stack falling back from Inter, footer with postal address and unsubscribe.
- **Design tokens are inlined at compile time** from Part A. Email CSS cannot use custom properties, so a small build step substitutes the literal hex values — the tokens stay the single source, the output stays Outlook-safe.
- `npm run mail:preview` renders every template with fixture data to `dist/mail-preview/` for visual review; `npm run mail:test <template>` sends one to yourself.

### Catalogue — event → email

| Trigger | Email | To | Category |
|---|---|---|---|
| `user.registered` | Verify your email | Customer | Transactional |
| `user.email_verified` | Welcome + first-order discount | Customer | Transactional |
| `user.password_reset_requested` | Reset your password | Customer | Transactional |
| `user.password_changed` | Your password was changed | Customer | Security |
| `order.placed` | We received your order | Customer | Transactional |
| `order.paid` | Order confirmed — invoice PDF attached | Customer | Transactional |
| `order.payment_failed` | Payment problem, with retry link | Customer | Transactional |
| `order.shipped` | On its way + tracking number | Customer | Transactional |
| `order.delivered` | Delivered | Customer | Transactional |
| `order.cancelled` | Order cancelled | Customer | Transactional |
| `order.refunded` | Refund issued | Customer | Transactional |
| `order.placed` | New order received | Admin | Ops |
| `return.requested` | We got your return request | Customer | Transactional |
| `return.approved` | Return approved + shipping label | Customer | Transactional |
| `return.rejected` | Return declined, with reason | Customer | Transactional |
| `return.refunded` | Refund on its way | Customer | Transactional |
| `return.requested` | Return needs review | Admin | Ops |
| `inventory.back_in_stock` | Back in stock | Waitlist | Opt-in |
| `inventory.low_stock_reached` | Low stock warning | Admin | Ops |
| `cart.abandoned` | You left something behind (+ coupon) | Customer | Marketing |
| `order.delivered` + 7d | How did we do? Review request | Customer | Marketing |
| `review.replied` | We replied to your review | Customer | Transactional |
| `marketing.newsletter_subscribed` | Confirm your subscription (double opt-in) | Subscriber | Transactional |
| `contact.message_received` | We got your message / New enquiry | Customer + Admin | Transactional + Ops |
| `giftcard.issued` | Your gift card | Recipient | Transactional |

Each later build phase adds its own rows here. Adding an email is a template file plus a catalogue entry — never new plumbing.

### Delivery, logging, suppression

**`EmailMessage`** — `id`, `template`, `to`, `subject`, `category`, `payload jsonb`, `dedupe_key`, `status` (`queued|sent|delivered|bounced|complained|failed`), `provider_message_id`, `error`, timestamps. A row is written **before** the provider call, so a crash mid-send is still visible.

- **Idempotency** — `dedupe_key` is `{template}:{aggregateId}:{eventId}`, uniquely indexed. BullMQ is at-least-once; this is what stops a retried job sending two receipts.
- **Provider webhooks** — Resend posts delivered / bounced / complained / opened. Verify the signature, update the row, emit `email.bounced` / `email.complained`.
- **`EmailSuppression`** — address, reason, timestamp. Hard bounces and complaints insert automatically; the mailer checks it before every send. This one is legally load-bearing, not a nicety.
- **Unsubscribe** — marketing category only: signed-token link plus `List-Unsubscribe` and `List-Unsubscribe-Post` headers for one-click. Transactional mail carries no unsubscribe but still respects `NotificationPreference`.
- **`NotificationPreference`** — per-user, per-category opt-in, surfaced in My Account (Phase 5).

### Deliverability — before the first real send

Publish **SPF, DKIM, and DMARC** records for the sending domain and verify them in Resend. Send from a dedicated subdomain (`mail.<domain>`) so transactional reputation stays isolated from the root domain. Set a `Reply-To` that a human actually reads. If volume ramps, warm up gradually rather than blasting.

### Phasing

The infrastructure lands in **Phase 1** alongside auth — `MailProvider`, the MJML pipeline, `EmailMessage`, suppression, the dev gate, and the first two templates (verify email, reset password). Everything after that is content.

---

# Part C — Build Plan

## Phase 1 — Foundations + event backbone · MVP

**Dependencies**

```
@nestjs/config @nestjs/typeorm typeorm pg @nestjs/cqrs @nestjs/bullmq bullmq ioredis
@nestjs/schedule @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
class-validator class-transformer nestjs-cls nestjs-pino pino-http @nestjs/terminus
@nestjs/throttler helmet slugify @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
sharp blurhash file-type stripe resend mjml handlebars html-to-text
```

> `sharp` ships prebuilt per-platform binaries — pin the version and make sure the deploy image matches the dev platform. A Windows-built `node_modules` copied into a Linux container fails at require time.

**`backend/src/main.ts`** — add the global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) that `backend/AGENTS.md` mandates and that is currently missing, plus `enableCors()`, `helmet()`, a `/api/v1` prefix, and `rawBody: true` (Stripe signature verification needs the unparsed body). Keep the existing Swagger setup; add bearer auth to it.

**`backend/src/app.module.ts`** — `ConfigModule.forRoot({ isGlobal: true })` with Joi schema validation, `TypeOrmModule.forRootAsync` reading `DATABASE_URL` via `ConfigService.getOrThrow` (same async-factory shape as `Homework/Homework 24/src/app.module.ts`), `BullModule.forRootAsync`, `CqrsModule`, `ClsModule`, `ScheduleModule`.

**`backend/src/core/`** — the event infrastructure, written **before** any feature module:

```
core/
├── events/domain-event.base.ts
├── outbox/
│   ├── outbox.entity.ts
│   ├── outbox.repository.ts
│   ├── outbox-relay.service.ts     # cron + SKIP LOCKED
│   └── outbox.publisher.ts
├── bus/transactional-command.handler.ts   # runInTransaction(manager => …)
├── queues/
│   ├── queue-names.enum.ts
│   └── base.consumer.ts            # idempotency + retry policy
└── saga/
```

**`backend/src/common/`** — reuse the Homework 24 layout: `dto/pagination-query.dto.ts` (extended with `sort`/`order`), `filters/all-exceptions.filter.ts`, `interceptors/`, `decorators/{current-user,roles}.decorator.ts`, `guards/{jwt-auth,roles}.guard.ts`, `enums/role.enum.ts` (ADMIN, MANAGER, SUPPORT, EDITOR, CUSTOMER), `pipes/`.

**Schema + first migration** — define all entities up front; retrofitting TypeORM migrations is painful.

`User` · `Address` · `Category` · `Product` · `ProductVariant` · `ProductImage` · `InventoryItem` · `InventoryReservation` · `StockAdjustment` · `Review` · `Cart` · `CartItem` · `Order` · `OrderItem` · `Shipment` · `Return` · `ReturnItem` · `Payment` · `Refund` · `Coupon` · `CouponRedemption` · `GiftCard` · `ShippingZone` · `ShippingRate` · `TaxRate` · `WishlistItem` · `BackInStockRequest` · `Post` · `PostCategory` · `Tag` · `Page` · `Media` · `ContactMessage` · `NewsletterSubscriber` · `EmailMessage` · `EmailSuppression` · `NotificationPreference` · `ChatSession` · `ChatMessage` · `OutboxEvent` · `AuditLog` · analytics rollup projections

**`.env.example`**

```
DATABASE_URL=            # Neon POOLED  — runtime
DIRECT_DATABASE_URL=     # Neon DIRECT  — migrations only
REDIS_URL=
ROLE=all                 # api | worker | all
JWT_SECRET=
JWT_REFRESH_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=      # CloudFront origin

MAIL_PROVIDER=console    # console | resend | noop
RESEND_API_KEY=
MAIL_FROM=orders@mail.<domain>
MAIL_FROM_NAME=3legant Golf
MAIL_REPLY_TO=
MAIL_WEBHOOK_SECRET=     # Resend webhook signature
MAIL_DEV_REDIRECT=       # non-prod: every recipient rewritten to this
MAIL_DEV_ALLOWLIST=      # comma-separated addresses exempt from the redirect
MAIL_ADMIN_RECIPIENTS=   # who gets the Ops-category mail

ANTHROPIC_API_KEY=
PORT=3000
CORS_ORIGIN=http://localhost:4200
APP_URL=
```

> **Two data sources.** `data-source.ts` (the TypeORM CLI entry used by `migration:generate` / `migration:run`) reads `DIRECT_DATABASE_URL`; the runtime `TypeOrmModule.forRootAsync` reads `DATABASE_URL`. Getting this backwards produces migrations that appear to hang — comment it in both files.

**`auth/` module** — register, verify email, login, refresh, logout, forgot/reset password, `/me`. Stateless Bearer JWT + rotating refresh tokens; `JwtAuthGuard` sets `req.user` and the CLS context. Same client contract as Project-1: token in `localStorage`, client never sends a user id. Emits `user.registered` → verification email.

**`notifications/` module** — the B4 email subsystem, built here because auth is its first consumer and because getting the dev safety gate in place before any seeded data exists is much easier than retrofitting it. Ship: `MailProvider` + the three implementations, the MJML build step, `EmailMessage` / `EmailSuppression` / `NotificationPreference`, the dedupe key, the Resend webhook endpoint, the `mail:preview` and `mail:test` scripts, and two templates — **verify email** and **reset password**. Every later phase adds templates against these rails.

**Frontend foundations**

- Add `"strict": true` to `frontend/tsconfig.json` — Angular 22's template omits it and `AGENTS.md` requires strict typing.
- ✅ **Design tokens shipped.** `src/styles/_tokens.scss` (every Part A custom property), `_typography.scss` (the 21 mixins), `_breakpoints.scss` (`$breakpoint-*` variables + `tablet-up`/`desktop-up` mixins), `_reset.scss` (box-sizing, base body styles, `:focus-visible` ring on `--color-info`, `prefers-reduced-motion`). `styles.scss` is just the entry point: `@use`s the two font packages plus `tokens` and `reset`. `angular.json` sets `stylePreprocessorOptions.includePaths: ["src"]` so any component can `@use 'styles/typography' as type;` / `@use 'styles/breakpoints' as bp;` without relative-path climbing.
- `app.config.ts`: `provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor, correlationIdInterceptor]))`.
- **Fix `app.routes.server.ts`** — it currently prerenders `**`, which breaks every data-driven route. Set per-route modes: `Prerender` for home/blog/contact/static, `Server` for shop and PDP, `Client` for cart/checkout/account/admin.
- ✅ **Angular splash removed** from `app.html`/`app.ts` (now just `<router-outlet />`); `app.spec.ts` updated to match. `app.routes.ts` is still empty, so the app renders blank until Phase 3 ships a homepage — expected at this stage.
- Folders: `core/`, `shared/ui/`, `shared/layout/`, `features/{home,shop,product,cart,checkout,account,blog,pages,contact,auth,admin,assistant}/` — every feature lazy-loaded via `loadChildren`.
- Build the **A5 primitives first**, each standalone, using `input()`/`output()` functions and the `host` object. No `@HostBinding`, no explicit `standalone: true`, no `ChangeDetectionStrategy.OnPush` — all defaults in v22 per `frontend/AGENTS.md`.

## Phase 2 — Media service · MVP

Built early because catalog, blog, reviews, and avatars all depend on it — and because owning the pipeline is the clearest demonstration of the async-consumer half of the architecture.

**Storage abstraction** — one `StorageProvider` interface (`getUploadUrl`, `getObject`, `putObject`, `deleteObjects`, `publicUrl`) with a single `S3StorageProvider` on `@aws-sdk/client-s3`. Because the SDK speaks S3 to any compatible endpoint, switching vendors is an `.env` change: leave `S3_ENDPOINT` unset for AWS, or set it plus `S3_FORCE_PATH_STYLE=true` for Cloudflare R2 / Backblaze B2.

Two buckets — `golf-media-dev` and `golf-media-prod` — same code, separated by IAM policy. Dev hits real S3 exactly as production does, so signature, CORS, and cache-header bugs surface while building rather than on deploy day.

**Upload flow — bytes never touch Nest.** The browser requests a presigned `PUT` (short TTL, content-type and content-length locked into the signature), uploads straight to S3, then calls back to register the object. The backend validates the declared MIME against the real magic bytes with `file-type` and deletes anything that lied. Keys are content-addressed: `products/{uuid}/original.{ext}`.

**Processing pipeline** — `media.uploaded` → the `media` consumer streams the original and with `sharp`:

- generates a responsive ladder (320 / 640 / 960 / 1440 / 2048 wide) in **WebP and AVIF**, plus a JPEG fallback
- computes a **blurhash** for the LQIP placeholder
- extracts intrinsic width/height (fed to `NgOptimizedImage` so it reserves layout and avoids CLS)
- **strips EXIF** — customer review photos carry GPS data; this is a privacy requirement, not a nicety
- writes derivatives to `products/{uuid}/{width}.{fmt}` and emits `media.variants_generated`

Until that event lands the UI shows the blurhash — an honest use of eventual consistency rather than blocking the upload response.

**Deletion** is soft-then-hard: the `Media` row is marked deleted immediately, `media.deleted` goes on the queue, and the consumer issues a batched `DeleteObjects` covering the original and every derivative. A nightly cron reconciles both directions — bucket keys with no `Media` row, and `Media` rows whose keys 404 — and reports orphans to the admin.

**Serving** — public bucket behind CloudFront with long-lived immutable cache headers, since keys are content-addressed. Private objects (invoices, data exports) use short-lived presigned `GET`s.

**Frontend `shared/ui/media/`** — dropzone with drag-drop and paste, direct-to-bucket upload with real `PUT` progress, client-side crop, a **required alt-text field** (accessibility is graded), reorderable gallery, and an admin media-library browser with search, usage counts, and bulk delete.

## Phase 3 — Catalog · MVP

Modules `products/`, `categories/`, `reviews/`, `inventory/`, `search/`.

Commands `CreateProduct`, `UpdateProduct`, `PublishProduct`, `ArchiveProduct`, `AdjustStock`, `SubmitReview`, `ModerateReview` — each emitting its domain event via the outbox. Category tree via TypeORM materialized-path with drag-reorder.

**Search behind an interface** — ship Postgres full-text search (`tsvector` column + GIN index, weighted title > brand > description > tags) maintained by the `search` consumer. Keep `SearchProvider` abstract so Meilisearch can drop in later without touching callers. Typeahead endpoint, faceted filters, price histogram, sort by price / newest / rating / popularity.

**Inventory** — per-variant stock, reservations with TTL, an adjustment ledger with reason codes, `low_stock_reached` → admin alert, `back_in_stock` → notify everyone on `BackInStockRequest`.

**Reviews** — verified-purchase flag (checks `order.paid` history), photo attachments via Phase 2, moderation queue, admin replies, aggregate rating maintained by a consumer rather than recomputed per request.

Seed ~80 golf products with real attributes, variants, and images.

**Frontend** — Shop (`24:389`), Product Detail (`37:1912` — gallery, swatches, tabs, reviews, related carousel, recently-viewed, back-in-stock signup), Homepage 03 (`116:6824`), category landings, search results with typeahead, product compare.

## Phase 4 — Cart, checkout, orders · MVP

Modules `cart/`, `checkout/`, `orders/`, `payments/`, `coupons/`, `shipping/`, `tax/`.

Guest carts keyed by a signed cookie; `cart.merged` folds the guest cart into the user's on login. The **checkout saga** from B2 is the centrepiece.

**Stripe** — PaymentIntent creation, Elements on the client, `payment_intent.succeeded` / `.payment_failed` webhooks with signature verification, idempotency keys, refunds. `MockProvider` behind the same interface for offline dev.

**Coupons** — percentage / fixed / free-shipping, scoped to product or category, min-spend, per-user and global usage limits, date windows, stacking rules. Gift cards as a balance-tracked entity.

**Shipping & tax** — zones → rates → methods, free-shipping thresholds, weight tiers. Tax rates by region, applied at quote time and frozen onto the order.

Order state machine enforced in one place, every transition emitting an event and writing to the audit log. Invoice PDF generated by a queue consumer.

**Frontend** — cart (`56:5593`), flyout cart (`70:5335`), multi-step checkout with Stripe Elements (`59:10897`), order complete (`61:11644`), public order-tracking page. Cart as a signal store service, persisted and SSR-hydrated.

## Phase 5 — Customer account · MVP

My Account (`63:3891`), Addresses (`67:4507`), Orders + detail + invoice download + reorder (`68:4827`), Wishlist (`70:5110`), returns request flow, saved Stripe payment methods, notification preferences, avatar upload, GDPR export + account deletion.

Sign In / Sign Up modals (`172:12346`, `171:11483`) — prefer **Signal Forms** (`@angular/forms/signals`) per `frontend/AGENTS.md`, falling back to Reactive Forms where Signal Forms don't cover a case.

## Phase 6 — Admin dashboard

No Figma reference — design on the Part A tokens. Routes under `/admin`, guarded by `RolesGuard`.

| Area | Contents |
|---|---|
| Dashboard | Revenue / orders / AOV / conversion tiles, sales chart, top products, low-stock list, live activity feed **read straight from the audit log** |
| Products | CRUD, variant matrix editor, bulk actions, CSV import/export, media picker, SEO fields, scheduled publish |
| Categories | Tree CRUD with drag-reorder |
| Inventory | Stock by variant, adjustments with reason, reservations view, low-stock alerts, restock |
| Orders | List + filters, detail, status transitions, partial fulfillment, tracking numbers, refunds, internal notes, packing slip |
| Returns | RMA queue — approve/reject, receive, refund |
| Customers | List, detail, lifetime value, order history, notes, ban |
| Discounts | Coupon builder with rule editor, gift cards, usage reports |
| Shipping & tax | Zones, rates, methods, thresholds, tax rates |
| Reviews | Moderation queue, reply, feature |
| Content | Post and page CRUD (rich text), categories, tags, scheduling |
| Media | Library browse, upload, bulk delete, alt-text editing |
| Inbox | Contact messages, newsletter subscribers + export |
| Email | `EmailMessage` log with status filters, per-message payload + rendered preview, resend, suppression-list management, bounce/complaint rate, template gallery with send-test |
| Users & roles | Staff accounts, RBAC assignment |
| Settings | Store info, currency, sender identity + reply-to, feature flags |
| Audit log | Filterable event stream — the EDA payoff, visible in the UI |

## Phase 7 — Content & marketing

Blog list + post + category + tag + author (`52:4112`, `54:5208`), comments with moderation, related posts, RSS. Static page CMS (about, shipping, returns, privacy, terms, FAQ). Contact form → `ContactMessage` + admin notification (`50:2794`). Newsletter double opt-in. Instagram feed section. Sitemap + `robots.txt` generated by a cron consumer.

## Phase 8 — AI shopping assistant

**Backend `assistant/`** — add `@anthropic-ai/sdk`. Model **`claude-opus-5`** with adaptive thinking (`thinking: { type: 'adaptive' }`) and `output_config: { effort: 'medium' }`.

- Drive the loop with the SDK tool runner (`client.beta.messages.toolRunner`, tools defined via `betaTool` with raw JSON Schema — no Zod dependency needed). Its per-turn hooks provide exactly the approval gating the cart tools require. Stream to the browser over **SSE** (`@Sse()` in Nest) so a long turn never trips an HTTP timeout.
- **Tools:** `search_products`, `get_product`, `compare_products`, `get_categories`, `check_stock`, `add_to_cart`, `update_cart_item`, `apply_coupon`.
- **Security invariant:** every tool resolves the user/session id from the CLS request context, **never** from model input — the model must have no way to address another user's cart. Tool handlers dispatch through the same CommandBus as the HTTP layer, so assistant-driven mutations emit identical domain events and land in the audit log tagged with their source.
- Cart-mutating tools return a "pending confirmation" result and the UI renders an approve/decline chip; read-only tools execute immediately.
- System prompt carries the golf vocabulary, the live category/attribute taxonomy, and a scope-discipline instruction. Cache it with `cache_control: { type: 'ephemeral' }` on the last system block, and keep the tool list deterministically ordered so the prefix stays stable across turns.
- Persist turns to `ChatSession` / `ChatMessage` so the panel survives a reload.

**Frontend `features/assistant/`** — navbar launcher, slide-over panel, streamed markdown, inline product cards rendered from `search_products` results linking to the PDP, confirmation chips for cart actions.

## Phase 9 — Observability & operations

Terminus health endpoints, Bull Board mounted at `/admin/queues`, dead-letter queue + replay, correlation-id-linked structured logs, Sentry, rate limiting on auth and assistant routes.

**Email health specifically** — alert on bounce rate above 2% or complaint rate above 0.1% (past those, providers start throttling), watch for a growing suppression list, and monitor `EmailMessage` rows stuck in `queued`.

Runbook covers: "an outbox row is stuck", "a consumer is failing", and "a customer says they never got their receipt" — the last one is a lookup by `dedupe_key` in `EmailMessage`, then the provider status on that row.

## Phase 10 — Polish & deploy

Full mobile pass across all 23 screens using the mobile node IDs, AXE / WCAG-AA audit (mandated by `frontend/AGENTS.md`), `NgOptimizedImage` everywhere, SSR meta + JSON-LD product / breadcrumb / article schema, Core Web Vitals pass, and a **deliberate** raise of the `angular.json` 500 kB warn / 1 MB error budget — a design-heavy build will exceed it, and that should be a decision rather than a deploy-day surprise.

**Deploy** per B3: Neon `main`, Railway for API + worker + Redis + SSR services, S3 + CloudFront for media. GitHub Actions runs lint/test/build on PRs and applies migrations against `DIRECT_DATABASE_URL` on merge to `main`, with a Neon branch per PR so preview environments get their own database.

---

# Part D — Testing & Verification

## Testing

Follow the conventions already configured rather than inventing new ones: colocated `*.spec.ts` and `test/*.e2e-spec.ts` on the backend (Jest 30 + supertest), Vitest on the frontend via `ng test` (`@angular/build:unit-test`).

Priority coverage, in order:

1. The **checkout saga's compensating path** — payment fails → inventory released → order cancelled
2. Outbox relay idempotency under concurrent relays
3. **Email idempotency** — replaying the same `order.paid` event sends exactly one receipt (unique `dedupe_key`)
4. **Suppression is honoured** — a suppressed address is never sent to, whatever the trigger
5. **The dev safety gate** — with `NODE_ENV !== 'production'`, a send to a non-allowlisted address is rewritten to `MAIL_DEV_REDIRECT`. Test this one properly; the failure mode is mailing real strangers
6. Cart merge on login
7. Coupon rule evaluation
8. Order state-machine illegal transitions
9. RBAC on every admin route
10. Per-user scoping of every assistant tool

## Verification

1. Create a fresh Neon branch, run `npm run typeorm migration:run` against `DIRECT_DATABASE_URL`, confirm it applies cleanly from empty; the seed script populates ~80 products and images. Rehearse **every** migration on a throwaway branch — that's what branching is for.
2. `cd backend && npm run start:dev` → Swagger at `/api` lists every module; `/health` reports Neon, Redis, Stripe, and S3 green (allow for a Neon cold start on the first hit).
3. **Event trace** — place an order and confirm one correlation id links HTTP request → `OrderPlaced` command → outbox row → BullMQ job → sent email → audit-log entry. This single check proves the architecture works.
4. **Compensation** — force a Stripe test decline; confirm inventory released, order `cancelled`, no confirmation email sent.
5. `cd frontend && npm start` → walk `/`, `/shop`, `/product/:slug`, `/cart`, `/checkout`, `/account`, `/blog`, `/admin` against real API data.
6. `npm run build && npm run serve:ssr:3legant` → SSR renders, no hydration mismatch warnings, per-route render modes took effect.
7. **Stripe end-to-end** — test card → webhook → order PAID → stock decremented exactly once. Replay the webhook to prove idempotency.
8. **Media** — upload a photo; confirm bytes went browser→S3 directly (nothing large in the Nest request log), blurhash renders first, the WebP/AVIF ladder appears once `media.variants_generated` lands, EXIF is stripped, and deleting removes the original *and* every derivative key.
9. **Email** — `npm run mail:preview` renders every template; check the order-confirmation in Gmail, Outlook, and on mobile (Outlook is where MJML earns its keep). Register a user and confirm the verify email arrives with a working link, a plain-text part, and an `EmailMessage` row. Replay `order.paid` and confirm exactly one receipt. Add an address to `EmailSuppression` and confirm the next send skips it. With `NODE_ENV=development`, send to a non-allowlisted address and confirm it lands at `MAIL_DEV_REDIRECT` instead. Check SPF/DKIM/DMARC pass on a real delivery before going live.
10. **Assistant** — "show me waterproof golf gloves under $30 for a left-handed player" streams a tool call with inline product cards; "add the second one to my cart" surfaces a confirmation chip before anything mutates; the resulting event appears in the admin audit log tagged assistant-sourced.
11. **Design fidelity** — cross-check three built screens against their Figma nodes with `get_screenshot` at 1440px and 375px; run AXE on Home, Shop, PDP, Checkout.

---

# Open items

| Item | Decision needed |
|---|---|
| **Semantic colours** | The template has no red at all (sale badges are green). `--color-error` / `--color-warning` in A3 are our additions — validate against WCAG AA before locking |
| **Tablet tier** | No 768px frame exists in the template; that breakpoint's design is ours to make |
| **Homepage variant** | Plan assumes Homepage 03. 01 / 02 / 04 remain documented alternates |
| **Admin design language** | Reuse the Poppins/Inter pairing, or drop to Inter-only for data density? |
| **Sending domain** | B4 assumes `mail.<domain>`. Pick the domain and publish SPF/DKIM/DMARC early — DNS propagation and Resend verification are the kind of thing that blocks a launch day |
