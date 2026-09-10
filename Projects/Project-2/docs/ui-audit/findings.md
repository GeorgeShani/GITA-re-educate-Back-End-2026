# 3legant Golf — UI Consistency Audit: Findings Catalog

**Date:** 2026-09-10
**Scope:** Every route, desktop (1440×900) + mobile (390×844), against the locked design
system in `SCOPE.md` Part A, `frontend/src/styles/_tokens.scss`, `_typography.scss`,
`_breakpoints.scss`, the shared primitives in `frontend/src/app/shared/ui/`, and the admin
primitives in `frontend/src/app/features/admin/ui/`.
**Method:** Full screenshot sweep in `docs/ui-audit/{desktop,mobile}/*.png` + `capture-report.json`,
cross-referenced against component source. Four items re-verified live at `localhost:4200`
(admin layout, hero alignment, footer link colour, notification/banner copy).
**Constraint:** No application code or styles changed. Raw catalog; ordered plan in `refinement-plan.md`.

Severity: **P0** = broken/unusable · **P1** = visibly inconsistent or off-spec · **P2** = polish.

---

## 1. Global / cross-cutting

| # | Title | Routes / files | Sev | Evidence |
|---|-------|----------------|-----|----------|
| G1 | **Admin shell layout collapses on every `/admin/*` page at ≥900px.** `.layout` is `grid-template-columns: 240px 1fr`, but `<drawer-panel>` (mobile nav) is the 3rd flow child of `.layout` and — because CSS grid blockifies every direct child — becomes a phantom grid item in col 2 / row 1. `<div class="content">` is auto-placed into col 1 / row 2 and renders **240px wide, below the sidebar**. Live-verified at 1280px: `.content` rect `{x:0, y:220, width:240}`; `.layout` children = `[mobile-bar(none), sidebar(flex), drawer-panel(block), content(block)]`. `DrawerPanel` has **no `:host` style at all** — it always portals its template through CDK Overlay, so the host should occupy zero layout space. `account-shell.ts` uses the same grid with no `<drawer-panel>` child, so it's fine. `site-header.ts` also embeds a `<drawer-panel>` but inside a sticky flex bar, so it degrades silently rather than breaking. | `features/admin/admin-shell.ts:50-88`, `shared/ui/drawer-panel.ts` | **P0** | every `desktop/admin-*.png` |
| G2 | **Hero content is horizontally centred, ~300px right of the page gutter.** `.hero` is `display:grid` with no `grid-template-columns`/`justify-items`, so `<page-container>` shrink-wraps to its content (~576px) and centres in the hero band. Live: `.hero h1` left = **379px**; every section heading below (`assurances`, `Featured`, footer) left = **75px**. The headline also drifts off the darkest part of the left-weighted scrim, hurting contrast. | `features/home/home.ts` `.hero` (styles ~190-202) | **P1** | `desktop/home.png` |
| G3 | **`notification-bar` promo copy is hardcoded, not coupon-driven.** `<span>30% off storewide — limited time</span>` is a literal string. The home `sale-banner` headline *is* coupon-driven (`Hurry up! {value}% off` from `GET /coupons/featured`), so the two diverge the moment the featured coupon changes type/value, and "storewide" is an unverified scope claim. They read the same only because SUMMER30 is 30%. | `shared/layout/notification-bar.ts:25` | P1 | all pages |
| G4 | **Promo message duplicated on the home page.** Top `notification-bar` ("30% off storewide") and mid-page `sale-banner` headline ("Hurry up! 30% off") state the same offer twice within ~1.5 viewports. | `notification-bar.ts`, `features/home/sale-banner.ts` | P2 | `desktop/home.png` |
| G5 | **Error toasts overlap the site header and are clipped at the top.** `toast-stack` renders top-right; on `shop-filtered`, `verify-email`, `account-return-new` the red toasts sit on top of the search/account/cart icons and the first toast is cut off above the notification bar. | `shared/ui/toast-stack.ts` | P1 | `desktop/shop-filtered.png`, `desktop/verify-email.png`, `desktop/account-return-new.png` |
| G6 | **No shared page-header; H1 scale and sub-copy vary by page family.** `headline-5` on shop/blog/cart/PDP-buy-box; `headline-4` on sign-in/sign-up/forgot/reset/verify/track/contact/content-pages. Blog has a sub-head, shop doesn't, content-pages have neither. Cart H1 is left-aligned; track/auth H1s are centred. The Figma has a `Page Header (3)` component that isn't implemented. | `features/*` page components | P1 | `desktop/shop.png` vs `desktop/sign-in.png` vs `desktop/blog-list.png` vs `desktop/cart.png` |
| G7 | **Two different "selected sidebar item" treatments.** Shop and Blog filter lists mark the active item with a **solid black pill** (`background: var(--color-neutral-07)`); Account and Admin nav mark it with a **white raised box**. All four are left-hand list navs. | `features/shop/shop.ts:248-252`, `features/blog/blog-list.ts:185-188`, `features/account/account-shell.ts:107-111`, `features/admin/admin-shell.ts:150-157` | P1 | `desktop/shop.png`, `desktop/account-profile.png`, `desktop/admin-dashboard.png` |
| G8 | **Undocumented green button variant.** `action-button` has `variant="accent"` (`background: var(--color-success)`), used by `sale-banner` "Shop now". Green is also the assurance-strip icons, the wordmark dot, and the sale-banner eyebrow. `SCOPE.md` A5 fills every button with `--color-neutral-07`; A3 reserves `--color-success` for status/sale semantics. The green "Shop now" is the only green CTA and stacks green-on-green with the eyebrow on a dark panel. An inverted (white) primary is the on-spec dark-surface CTA. | `shared/ui/action-button.ts:160-163`, `features/home/sale-banner.ts:74` | P1 | `desktop/home.png` |
| G9 | **Disabled primary button reads as permanently inactive.** `action-button` disabled state is only `opacity: 0.5`, so black-on-white becomes mid-grey (sub-AA). On the PDP the CTA sits disabled ("Select options") until both variant selects are chosen and looks like dead chrome. | `shared/ui/action-button.ts:98-102`; `features/product/product-purchase-panel.ts:70-78` | P1 | `desktop/product-detail.png`, `desktop/reset-password.png` |
| G10 | **`empty-state` primitive adopted on ~half the surfaces that need it.** Uses it: `shop.ts`, `account-wishlist/returns/payment-methods`, all admin lists. Rolls its own: `cart.ts` (`.empty`), `product-detail.ts` error (`.message`), `blog-list.ts` error+empty, `verify-email.ts`, `account-return-new.ts`. The component's doc comment says the storefront states "should get the same real treatment." | `shared/ui/empty-state.ts`; `cart.ts`, `product-detail.ts`, `blog-list.ts`, `verify-email.ts` | P1 | `desktop/cart.png` vs `desktop/account-wishlist.png` vs `desktop/verify-email.png` |
| G11 | **`select-field` resting border is off-spec and reads as focused.** Uses `box-shadow: inset 0 0 0 2px var(--color-border-input)` (#cbcbcb, the *text-input* token). `SCOPE.md` A5 Dropdown = "2px `--color-neutral-04` border". A 2px inset ring in the wrong lighter colour looks like a permanent focus state on every `Sort by` / filter / variant select. | `shared/ui/select-field.ts:119` | P1 | `desktop/shop.png`, `desktop/admin-products.png`, `desktop/product-detail.png` |
| G12 | **Brand name is inconsistent.** Wordmark `3legant.` (green dot); prose "3legant Golf" (`sign-in`, `sign-up`, About); admin `3legant. Admin` with a **grey** dot. | `shared/layout/site-header.ts:46`, `site-footer.ts`, `features/admin/admin-shell.ts:53,67,142-148`, `features/auth/*` | P2 | `desktop/sign-in.png`, `desktop/admin-dashboard.png` |
| G13 | **Footer omits legal / About pages that exist in the CMS.** `admin/pages` lists About Us, Privacy Policy, Terms of Service, Shipping Policy, Returns & Refunds, FAQs. Footer `INFO_LINKS` only wires Shipping / Returns / Support(→/contact) / FAQs. No Privacy, no Terms, no About link anywhere. | `shared/layout/site-footer.ts:14-19` | P1 | `desktop/admin-pages.png` vs any footer |
| G14 | **Home page is four stacked dark bands.** Notification bar, assurance strip, sale-banner, newsletter are all `--color-neutral-07`; heavy, repetitive rhythm on scroll. | `home.ts`, `notification-bar.ts`, `sale-banner.ts`, `newsletter-signup.ts` | P2 | `desktop/home.png` |
| G15 | **Grids leave a dead zone on the last row.** 10 category tiles / 4-col (`home`), 12 products / 3-col (`shop`), 8 posts / 3-col (`blog`) each end with a short final row and visible empty space on the right. | `home.ts` `.categories`, `shop.ts` `.grid`, `blog-list.ts` `.grid` | P2 | `desktop/home.png`, `desktop/shop.png`, `desktop/blog-list.png` |

---

## 2. Storefront

| # | Title | Routes / files | Sev | Evidence |
|---|-------|----------------|-----|----------|
| S1 | **Category filtering by slug crashes the page.** `/shop?category=gloves` → `400 "category must be a mongodb id"` on `/products` **and an unhandled `500`** on `/products/facets?category=gloves`. Result: two stacked red error toasts over the header, "Could not load products right now.", no brand facets, H1 stuck on "All products". The app's own home tiles pass `category.id` so they work, but any hand-typed / shared / legacy slug URL breaks — and `shop.ts`'s doc comment sells filtered views as "shareable, survives a reload." Opaque ObjectId params also make real shared URLs ugly. | `features/shop/shop.ts:95,300-314`; `features/home/home.ts:149`; backend `/products`, `/products/facets` | **P1** | `desktop/shop-filtered.png`, `mobile/shop-filtered.png`, `capture-report.json` |
| S2 | **Product rating aggregates are empty everywhere despite 249 seeded reviews.** `ProductDto.ratingAverage`/`ratingCount` are 0, so `product-purchase-panel` renders **5 hollow stars** on every PDP and `product-card` renders **no stars at all** (`@if (product().rating)` hides them when falsy). The seed didn't run the rating rollup. Also an inconsistent zero-state: PDP shows empty stars, cards hide the rating. | `features/product/product-purchase-panel.ts:34-37`; `shared/ui/product-card.ts:94`; `shared/ui/rating-stars.ts`; backend rating projection | **P1** | `desktop/product-detail.png`, `desktop/shop.png` |
| S3 | **PDP has no gallery and a single generic photo.** `product-gallery` only renders thumbnails/arrows when `images.length > 1`; the seed gives every product exactly one image. | `features/product/product-gallery.ts`; `backend/scripts/seed-catalog.ts:171` | P1 | `desktop/product-detail.png`, `mobile/product-detail.png` |
| S4 | **PDP: large vertical whitespace under the buy-box and around the Description tab.** `.layout` is `1fr 1fr` at tablet-up; the gallery column is ~728px tall, the buy-box column ~500px, leaving a tall gap before the full-width `page-section spacing="lg"` tabs section, then another `lg` gap before "You might also like". | `features/product/product-detail.ts:72-118` | P1 | `desktop/product-detail.png` |
| S5 | **PDP description is printed twice** — once under the title in `product-purchase-panel`, once in the Description tab. | `product-purchase-panel.ts:41`, `product-detail.ts:93` | P2 | `desktop/product-detail.png` |
| S6 | **Product & category imagery is generic and heavily duplicated (client's explicit complaint).** `seed-catalog.ts` calls Pexels with `per_page=1` and takes `photos[0]` — the single top hit — with no cross-product dedup. Pexels' free library has almost no true golf-*product* photography, so most "golf X" queries resolve to the same handful of lifestyle shots. One man-mid-swing-with-bag photo appears on *Yardage Distance Wheel, Bag Rain Cover, Speed Training Sticks Set, Mock Neck Golf Shirt, Players Fit Glove, Collection Leather Glove, HyperGrip Synthetic Glove*; one woman-putting photo on *Putting Alignment Mirror, Structured Visor, Warm-Up Joggers*. Home category tiles are wrong too (Gloves = ball on a tee; Towels / Training Aids = pile of balls). **Estimated ~60–70 of 105 products** have a photo that doesn't depict the product — essentially all gloves, training aids, apparel, accessories, rangefinders, headcovers, plus scattered others; balls and tees are mostly acceptable. The `imageQuery` strings themselves are fine (specific, golf-anchored) — the failure is the resolver + Pexels' library + 1-image-per-product. `mix-blend-mode: multiply` on the neutral-02 card background (a cutout-on-white treatment) further muddies the full-bleed lifestyle photos. | `backend/scripts/seed-data/products.ts` (`imageQuery`), `backend/scripts/seed-catalog.ts:53-97`, category seed; `shared/ui/product-gallery.ts:66-69` | P1 | `desktop/shop.png`, `desktop/product-detail.png`, `desktop/home.png` |
| S7 | **`sale-banner` sub-copy is leftover template text.** `<p class="subhead">Find clubs that are right for your game</p>` is hardcoded — and "clubs" is not a catalog category (A8: gloves, balls, tees, headcovers, towels, bags, rangefinders & GPS, apparel, training aids, accessories). The headline above it is coupon-aware; the sub-copy is not. Rest of the component is clean. | `features/home/sale-banner.ts:58` | P1 | `desktop/home.png` |
| S8 | **Newsletter form doesn't use the design-system field.** `newsletter-signup` is a bespoke flex row with a borderless `border-bottom` input and a transparent "Signup" text button — uses neither `text-field` (h40, radius 6, 1px border) nor `action-button`. No other input on the site looks like this. | `features/home/newsletter-signup.ts:28-42` | P1 | `desktop/home.png`, `desktop/product-detail.png` |
| S9 | **`sale-banner.jpg` reused as the newsletter background; triggers an LCP warning.** `newsletter-signup` uses `ngSrc="/images/products/sale-banner.jpg"` `priority="false"` as a grayscale full-bleed background behind an 88% scrim; on the PDP this becomes the LCP element and logs `NG02955`. The same asset is also the `sale-banner` left-half image, so one generic golf-cart stock photo appears twice on the home page and on every page carrying the newsletter block. | `features/home/newsletter-signup.ts:13-19`; `features/home/sale-banner.ts:53` | P2 | `capture-report.json` (product-detail), `desktop/home.png` |
| S10 | **`/shop` brand filter is an unbounded ~38-row list with no "show more".** On desktop it makes the 220px sidebar far taller than the 3-wide product grid on the "All categories" view, leaving a large dead zone. | `features/shop/shop.ts:104-130` | P1 | `desktop/shop.png` |
| S11 | **Product cards never show SALE / NEW badges.** `product-card` supports a `badges` array (`status-badge`), but no card anywhere renders one — `toCardProduct` isn't mapping compare-at price / featured / recency to badges. | `shared/ui/product-card.ts:69-75`; `core/services/catalog.service.ts` (`toCardProduct`) | P2 | `desktop/shop.png`, `desktop/home.png` |
| S12 | **FAQ contradicts the checkout implementation.** `/pages/faq`: "Do I need an account to order? No — guest checkout is available." `cart.ts` `checkout()` + doc comment: "No guest checkout — Order.userId is required server-side"; guests are redirected to `/sign-in`. | FAQ page content; `features/cart/cart.ts:385-396` | P1 | `desktop/content-page-faq.png` |
| S13 | **Contact page is form-only.** The Figma "Contact Us 01" pairs the form with contact details (address, email, hours, channels). Implemented page has just the form. | `features/contact/contact.ts` | P2 | `desktop/contact.png` |
| S14 | **FAQ is flat prose, not the `accordion` primitive.** `accordion-group`/`accordion-panel` exist (demoed in the styleguide); the FAQ renders every Q&A expanded with no jump-nav for its four category sections. | `features/pages/content-page.ts`; `shared/ui/accordion-*` | P2 | `desktop/content-page-faq.png` |
| S15 | **Content pages (`/pages/*`) pin a ~640px prose column to the left with ~50% empty page width, and have no page-header treatment.** | `features/pages/content-page.ts` | P2 | `desktop/content-page-about.png`, `desktop/content-page-faq.png` |
| S16 | **Inline links in rendered content don't use the link colour.** FAQ body links ("order history", "shipping policy") are underlined but body-grey, not `--color-info` / `--color-info-text`. | `features/pages/content-page.ts` (`::ng-deep a`) | P2 | `desktop/content-page-faq.png` |
| S17 | **`blog-post` hero image is wider than the prose column and the two don't share a left edge**; a stray footer-style payment-icon row also appears top-right of the article (verify live — likely a misplaced element). | `features/blog/blog-post.ts` | P2 | `desktop/blog-post.png` |
| S18 | **Blog card excerpts clamp mid-word** (`-webkit-line-clamp: 2` → "…with a bad rea…"). Acceptable but rough. | `features/blog/blog-list.ts:256-264` | P2 | `desktop/blog-list.png` |
| S19 | **AI-assistant FAB appears inconsistently.** Present on `/account/*`, `/checkout`, `/checkout/complete`; absent on `home`, `shop`, PDP (where a shopping assistant is most useful) and on `/cart` — even though `/checkout` renders the identical empty-cart `/cart` view and *does* show it. | `core/services/assistant-panel-state.service.ts`; `features/assistant/assistant-panel.ts` | P2 | `desktop/checkout.png` vs `desktop/cart.png`; account/home screenshots |
| S20 | **404 / auth "failed" states are three visual languages.** `not-found` = giant ghost "404" + headline + button; `verify-email` failure = centred headline + text + text-link, no icon/container; `shop` error = `empty-state` icon + "Try again". | `not-found.ts`, `verify-email.ts`, `shop.ts` | P2 | `desktop/not-found.png`, `desktop/verify-email.png`, `desktop/shop-filtered.png` |
| S21 | **`styleguide` is reachable (dev-guard only) and has a copy typo.** "Dev-only. Components **lend** here…" (→ "land"). | `features/styleguide/styleguide.ts` | P2 | `desktop/styleguide.png` |

---

## 3. Account

| # | Title | Routes / files | Sev | Evidence |
|---|-------|----------------|-----|----------|
| A1 | **`/account/returns/new` renders blank when reached without an order.** Just the "Request a return" H1 and empty space; a red "Invalid id: undefined" toast fires (`400` + `HttpErrorResponse`). No order picker, no error `empty-state`, no way forward. | `features/account/account-return-new.ts` | **P1** | `desktop/account-return-new.png`, `mobile/account-return-new.png`, `capture-report.json` |
| A2 | **Order-status badges are all the same green.** `status-badge` only has `sale`(green) / `new`(white) / `custom`; `account-orders`, `account-order-detail`, `admin-orders`, `admin-order-detail`, `admin-returns`, and the address "DEFAULT" badge all render green regardless of meaning ("PREPARING", "SHIPPED", "DELIVERED", "PAID" identical). No semantic status colour system. | `shared/ui/status-badge.ts`; `account-orders.ts`, `account-order-detail.ts`, `account-addresses.ts`, `admin-orders.ts` | P1 | `desktop/account-orders.png`, `desktop/admin-order-detail.png` |
| A3 | **"Add new X" is placed three different ways across account.** `addresses` = filled button, top-right; `returns` = plain underlined text link, top-right; `payment-methods` = button under the H1, left, disconnected from a centred `empty-state` graphic floating mid-page. | `account-addresses.ts`, `account-returns.ts`, `account-payment-methods.ts` | P1 | `desktop/account-addresses.png`, `desktop/account-returns.png`, `desktop/account-payment-methods.png` |
| A4 | **Ad-hoc small-button style not in the system.** "Change photo", "Edit", "Remove", "Sign out", "Delete my account" render as a bordered box wrapping underlined text (destructive ones in red). `action-button` has no such variant; the styleguide doesn't show one. | `account-profile.ts`, `account-addresses.ts`, `account-settings.ts`, `account-shell.ts` | P1 | `desktop/account-profile.png`, `desktop/account-addresses.png`, `desktop/account-settings.png` |
| A5 | **Empty states float centre-of-column while the H1 sits top-left.** `empty-state` is always `align-items: center`; on `wishlist`/`returns`/`payment-methods` it sits page-centre, detached from the left-aligned heading. | `shared/ui/empty-state.ts`; account pages | P2 | `desktop/account-wishlist.png`, `desktop/account-returns.png` |
| A6 | **Account content is a narrow left-pinned column (~470–640px) with 40–50% empty page width** on every `/account/*` section. Address cards span the full ~1090px with tiny content and Edit/Remove floated far right. | `account-shell.ts` `.content`; individual pages | P2 | `desktop/account-settings.png`, `desktop/account-addresses.png` |
| A7 | **Blank avatar with no initials fallback** — empty grey circle, no "JW" monogram. | `account-profile.ts` | P2 | `desktop/account-profile.png` |
| A8 | **Locked email field looks empty** — disabled Email input renders its value in placeholder-grey, reading as an empty field with a placeholder. | `account-profile.ts` | P2 | `desktop/account-profile.png` |
| A9 | **Order cards have no "view details" affordance** (no chevron/button) though `/account/orders/:id` exists; wide dead gap between the order-number block and the right-aligned badge+price. | `account-orders.ts` | P2 | `desktop/account-orders.png` |
| A10 | **`order-complete` shows a "DELIVERED" badge under "Order received"** (seeded-order artifact), no confirmation-email note / next-steps / ETA; "Continue shopping" is a text link here but a filled button in the cart empty state. | `features/checkout/order-complete.ts` | P2 | `desktop/order-complete.png`, `mobile/order-complete.png` |

---

## 4. Admin

*(Every admin screenshot is distorted by G1; issues below are still assessable or read from source.)*

| # | Title | Routes / files | Sev | Evidence |
|---|-------|----------------|-----|----------|
| D1 | See **G1** — the P0. Blast radius: all 19 admin routes, **desktop only (≥900px)**. Mobile admin (`<900px`) is unaffected and renders correctly. | `features/admin/admin-shell.ts` | **P0** | all `desktop/admin-*.png` |
| D2 | **19-item flat nav overflows the viewport at common laptop heights.** `.sidebar` is `height: 100dvh; overflow-y: auto` with 19 links + wordmark + role line + a "Job queues (Bull Board)" link. At 900px tall the last items ("Users & roles", "Audit log", "Job queues") fall below the fold with no scroll affordance — "Audit log" is absent from the visible nav on most captures. Needs grouping (Catalog / Commerce / Money / Content / People). | `features/admin/admin-shell.ts:18-38,125-140` | P1 | `desktop/admin-*.png`, `desktop/admin-audit-log.png` |
| D3 | **`admin/inventory` has no pagination.** Every other large list (`products`, `orders`, `reviews`, `users`, `audit-log`, `media`, `newsletter`) paginates; inventory renders every variant row in one page — the captured page is **25,354px** tall. | `features/admin/admin-inventory.ts` (no `PaginationNav`) | P1 | `desktop/admin-inventory.png` (1.3 MB), `mobile/admin-inventory.png` (1.4 MB) |
| D4 | **Admin looks unfinished because seeded data doesn't reach several sections.** `Reviews` defaults its filter to "Pending" → "Nothing in this queue" despite 249 approved reviews. `Media library` 0, `Newsletter` 0, `Email log` 0, `Contact inbox` 0. Five of ~19 sections are empty states on a fully-seeded store. | `admin-reviews.ts` (default filter), `admin-media.ts`, `admin-newsletter.ts`, `admin-email.ts`, `admin-contact.ts`; seed scripts | P2 | `desktop/admin-reviews.png`, `desktop/admin-media.png`, `desktop/admin-newsletter.png`, `desktop/admin-emails.png` |
| D5 | **`admin/coupons` rows are enormously over-tall** (~250px each in the crushed column; verify at full width). | `admin-coupons.ts`, `features/admin/ui/data-table.ts` | P2 | `desktop/admin-coupons.png` |
| D6 | **`admin-order-detail` summary rows collide** — "Subtotal$419.97", "Total$450.42" with no gap (a `justify-content: space-between` collapsing in the 240px column; re-check post-G1). Also no order-status actions (fulfil/ship/refund/cancel), no customer contact, minimal payment info. | `admin-order-detail.ts` | P2 (P1 if it persists post-G1) | `desktop/admin-order-detail.png` |
| D7 | **`admin/emails` suppression-list card: "Suppress" / "Remove suppression" buttons escape the card** to the right (card is 240px from G1). Re-check post-G1. | `admin-email.ts` | P2 | `desktop/admin-emails.png` |
| D8 | **Admin filter controls stack vertically instead of sitting in a `filter-bar` row** (`admin-products`: Category + Status stacked; `admin-emails`: Status / Category / Recipient stacked). Partly G1 — confirm the intended layout uses `features/admin/ui/filter-bar.ts`. | `admin-products.ts`, `admin-email.ts`, `features/admin/ui/filter-bar.ts` | P2 | `desktop/admin-products.png`, `desktop/admin-emails.png` |
| D9 | **Admin wordmark dot is grey, storefront's is green** (see G12). | `admin-shell.ts:142-148` | P2 | `desktop/admin-dashboard.png` |

---

## 5. Responsive (mobile, 390px)

| # | Title | Routes / files | Sev | Evidence |
|---|-------|----------------|-----|----------|
| M1 | **`/shop` and `/blog` dump the entire filter sidebar above the product grid.** `.layout` only becomes two-column `@include bp.tablet-up`; below 768px the `<aside class="filters">` stacks first. On `/shop` that is ~11 category buttons **+ ~38 brand buttons ≈ 49 controls** before the first product. No "Filters" button, no `drawer-panel`, no collapse — despite `drawer-panel` being built for this. | `features/shop/shop.ts:203-210`, `features/blog/blog-list.ts:142-149` | **P1** | `mobile/shop.png`, `mobile/blog-list.png` |
| M2 | **`account-orders` status badge overlaps the order number and price on mobile.** The order-number text wraps, then badge + price land on the same row with no space and visually collide ("MTUM28CX-" / "DELIVERED" over "6A1E" over "$16"). The FAB also overlaps the first card's badge. | `features/account/account-orders.ts` | **P1** | `mobile/account-orders.png` |
| M3 | **Assistant FAB overlaps form content on mobile** — over the avatar / "Change photo" row on `account-profile`, over the "Continue shopping" link on `order-complete`. | `features/assistant/assistant-panel.ts` | P2 | `mobile/account-profile.png`, `mobile/order-complete.png` |
| M4 | **Account nav is a full-height card above content on every `/account/*` page** (7 links + Sign out ≈ 450px to scroll past each time). No collapse. | `account-shell.ts` `.layout` at `<wide-up` | P2 | `mobile/account-profile.png`, `mobile/account-orders.png` |
| M5 | **PDP quantity stepper + "Select options" share one cramped row on mobile** — `.purchase-row` stays `flex` with no wrap; the disabled grey button is squeezed next to the 80px stepper. | `product-purchase-panel.ts:64-79,151-160` | P2 | `mobile/product-detail.png` |
| M6 | **Admin data tables need horizontal scroll on mobile** (expected via `data-table` `overflow-x:auto`, but Name wraps to 3 lines and Price is cut at the edge; no card-style fallback). | `features/admin/ui/data-table.ts`; `admin-products.ts` | P2 | `mobile/admin-products.png` |
| M7 | **Utility-page H1s (`headline-4`, 40px) nearly span the 390px screen** ("Get in touch", "Create an account") — no mobile step-down. | `contact.ts`, `sign-up.ts` | P2 | `mobile/contact.png`, `mobile/sign-up.png` |

---

## 6. Accessibility (visible)

| # | Title | Routes / files | Sev | Evidence |
|---|-------|----------------|-----|----------|
| X1 | **Unrated products announce "0 out of 5 stars".** `rating-stars` non-interactive `aria-label` is `value() + ' out of ' + max() + ' stars'`; with no rollup data (S2) every PDP announces a 0 rating rather than "not yet reviewed". | `shared/ui/rating-stars.ts:16-18`; `product-purchase-panel.ts` | P1 | `desktop/product-detail.png` |
| X2 | **Disabled CTA contrast (G9).** `opacity: 0.5` on white-on-black ≈ 2.8:1. Disabled controls are exempt from the WCAG minimum, but the state is indistinguishable from a low-priority button and gives no hint why it's disabled. | `shared/ui/action-button.ts:98-102` | P1 | `desktop/product-detail.png` |
| X3 | **Mobile drawer nav has no current-page indicator.** Desktop nav uses `<nav-link>` with an active state; the mobile drawer uses bare `<a>` with none. | `shared/layout/site-header.ts:78-84` | P2 | `mobile/*` (drawer) |
| X4 | **Error toasts over the header (G5)** can cover the interactive account/cart controls, making them unclickable until the toast dismisses. | `shared/ui/toast-stack.ts` | P1 | `desktop/shop-filtered.png` |
| X5 | **Audit any status text on dark surfaces.** `sale-banner` eyebrow is `--color-success` green on near-black (~7:1, passes), but `_tokens.scss` flags `--color-warning` / plain `--color-success` as risky as text. | `features/home/sale-banner.ts:126-129` | P2 | `desktop/home.png` |
| X6 | **Hero headline contrast improves once G2 is fixed** — mis-centred it sits on ~25% scrim opacity; at the left gutter it sits on ~92%. | `home.ts` | P2 | `desktop/home.png` |

*(A full automated AXE pass was out of scope — `frontend/.claude/CLAUDE.md` mandates one before merge. The primitives themselves — `select-field`, `drawer-panel`, `rating-stars` — carry solid ARIA patterns; the risks above are integration-level.)*

---

## 7. Imagery / content

| # | Title | Routes / files | Sev | Evidence |
|---|-------|----------------|-----|----------|
| I1 | **~60–70 of 105 product photos don't depict the product; many are byte-identical duplicates** (full detail in **S6**). | `backend/scripts/seed-catalog.ts`, `seed-data/products.ts` | P1 | `desktop/shop.png`, `desktop/product-detail.png` |
| I2 | **Home category tiles show the wrong subject** — Gloves = ball on a tee, Towels / Training Aids = pile of balls, Apparel = person in a hallway. Same Pexels-top-hit pipeline, applied to the category `imageUrl`. | category seed; `home.ts:151-153` | P1 | `desktop/home.png`, `mobile/home.png` |
| I3 | **One image per product → no real PDP gallery** (S3). | `seed-catalog.ts:171` | P1 | `desktop/product-detail.png` |
| I4 | **Order-history and order-detail line-item thumbnails inherit the wrong photos** (e.g. "4 Yards More Tees" shows a pile of golf balls). | `account-order-detail.ts`, `order-complete.ts`, `admin-order-detail.ts` | P2 | `desktop/account-order-detail.png` |
| I5 | **Hardcoded / uncoordinated promo copy** — `sale-banner` sub-copy "Find clubs that are right for your game" (S7) + `notification-bar` "30% off storewide" (G3). | `sale-banner.ts:58`, `notification-bar.ts:25` | P1 | `desktop/home.png` |
| I6 | **FAQ claims guest checkout that doesn't exist** (S12). | FAQ page content | P1 | `desktop/content-page-faq.png` |
| I7 | **`styleguide` copy typo** "lend" → "land". | `features/styleguide/styleguide.ts` | P2 | `desktop/styleguide.png` |
| I8 | **`mix-blend-mode: multiply` on product images assumes white-background cutouts**; on the current lifestyle photos it darkens/muddies them. Correct once real product photography lands; compounds the problem now. | `shared/ui/product-gallery.ts:66-69`; `product-card` image | P2 | `desktop/shop.png` |

---

## 8. Console errors cross-check (`capture-report.json`)

| Route | Logged | UI impact |
|-------|--------|-----------|
| `shop`, `styleguide`, `blog-list` (mobile) | `NG02955` — LCP image not marked `priority` | None visible; perf nit. First product/post image should be `priority`. |
| `product-detail` | `NG02955` for `/images/products/sale-banner.jpg` | The **newsletter block's background image** is the LCP element (S9). Cosmetically invisible (grayscale, 88% scrim) — mark `priority` or drop `NgOptimizedImage`. |
| `shop-filtered` | `400` (`category must be a mongodb id`) + **`500`** on `/products/facets` | **High** — see S1. Stacked error toasts over the header, broken filter sidebar, wrong H1. |
| `verify-email` | `400` | Expected (demo token). Failure UI is fine content-wise but visually inconsistent (S20). |
| `account-return-new` | `400` + `HttpErrorResponse` | **High** — see A1. Blank page + toast. |

---

## Counts

- **P0:** 1 distinct defect (G1 / D1). Blast radius = all 19 admin routes at desktop width.
- **P1:** ~30 distinct entries.
- **P2:** ~30 distinct entries.
- **Verified live:** G1, G2, G3, S7. A suspected `:visited` link-colour inconsistency visible in the PNGs turned out to be a screenshot-gamma artifact — **not a real defect**; every footer link is uniformly `--color-neutral-05` (`rgb(52,56,57)`).
