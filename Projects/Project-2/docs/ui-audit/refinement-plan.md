# 3legant Golf — UI Refinement Plan

Ordered, phased execution plan built from `findings.md`. Effort: **S** ≈ ≤½ day / one-to-few-line,
**M** ≈ 1–2 days / one component or a small sweep, **L** ≈ 3+ days / cross-cutting or asset work.
Nothing here re-themes, adds brand colours, or adds fonts — `SCOPE.md` Part A is locked. This is
consistency, correctness, hierarchy, spacing rhythm, component reuse, responsive behaviour,
empty/loading/error states, and imagery quality *within* that system.

---

## Phase 1 — Broken layouts

| Item | Files | Change | Effort |
|------|-------|--------|--------|
| **1.1 Fix the admin shell P0.** | `shared/ui/drawer-panel.ts` | Add `:host { display: contents }`. The component always portals its template through CDK Overlay and renders nothing in place, so the host should generate no box — this removes it as a phantom grid item in `admin-shell` and de-risks the identical `<drawer-panel>` inside `site-header`. Verify the cart flyout / mobile menu still open and trap focus. Fallback if `display:contents` regresses anything: move `<drawer-panel>` outside `.layout` in `admin-shell.ts` (and the same in `site-header.ts`). | S |
| **1.2 Re-align the hero.** | `features/home/home.ts` (`.hero`) | The `.hero` grid doesn't stretch its `page-container` child, so the headline centres ~300px right of the page gutter. Add `grid-template-columns: minmax(0, 1fr)` (or `justify-items: stretch`, or `page-container { width: 100% }` scoped to `.hero`). Re-check `.hero h1` left aligns with the "Featured" heading (~75px at 1280). | S |
| **1.3 Category-filter crash + graceful unknown-category.** | `features/shop/shop.ts`, `features/home/home.ts`, backend `/products` + `/products/facets` | `/shop?category=<slug>` currently 400s on `/products` and **500s** on `/products/facets`. (a) Backend: accept `category` as slug **or** ObjectId on both endpoints; make an unknown category `400`, not `500`. (b) Frontend: emit slugs from `shop.ts` category buttons and `home.ts` tiles (also fixes shareable-URL ugliness). (c) `shop.ts`: on `products.error()` / `facets.error()`, render an `empty-state` ("We couldn't find that category") instead of letting two toasts stack over the header. | M (FE + BE) |
| **1.4 `/account/returns/new` no longer blanks.** | `features/account/account-return-new.ts` | When there's no `orderId` in the route, render an order-picker (`empty-state` + list of returnable orders) instead of firing a request with `undefined`. On a genuine load failure, render an error `empty-state`. | S–M |
| **1.5 Toasts stop covering the header.** | `shared/ui/toast-stack.ts` | Offset the stack below the sticky header (`top: calc(<header height> + var(--space-4))`), keep it clear of the header's right-side actions, and ensure the container isn't clipped by an `overflow:hidden` ancestor. | S |

**Phase 1 effort:** ~4 S + 1 M (+ backend coordination on 1.3).

---

## Phase 2 — Design-system consistency

| Item | Files | Change | Effort |
|------|-------|--------|--------|
| **2.1 Shared `page-header` component.** | new `shared/ui/page-header.ts`; adopt in `shop`, `blog-list`, `cart`, `account/*`, `auth/*`, `track`, `contact`, `content-page`, `not-found` | H1 + optional sub-head, one type scale (recommend `headline-4` desktop → `headline-5` mobile), one alignment (left, at the content gutter). Resolves G6, M7, and the cart-vs-track alignment split. | M |
| **2.2 Unify the "selected sidebar item".** | `features/shop/shop.ts`, `features/blog/blog-list.ts` (align to `account-shell` / `admin-shell`), or extract a shared `side-nav-list` | Pick ONE active treatment — recommend the white raised pill used by account/admin — and apply to the shop + blog filter lists. | S–M |
| **2.3 Semantic status colours.** | `shared/ui/status-badge.ts`; `account-orders`, `account-order-detail`, `admin-orders`, `admin-order-detail`, `admin-returns`, `admin-reviews` | Add variants `neutral` / `info` / `success` / `warning` / `danger` mapped to `--color-neutral-03/04`, `--color-info`, `--color-success`, `--color-warning`, `--color-error`. Add a `status → variant` map (pending/preparing → neutral, shipped/in-transit → info, delivered/paid → success, cancelled/failed/refunded → danger). Apply everywhere a state badge renders. | M |
| **2.4 Button system cleanup.** | `shared/ui/action-button.ts`; `sale-banner.ts`, `newsletter-signup.ts`, `product-purchase-panel.ts`, account pages | (a) Replace `variant="accent"` (green) with `variant="inverse"` (white fill / `--color-neutral-07` text) for dark-surface CTAs; update `sale-banner`. (b) Give disabled buttons a real treatment (`--color-neutral-03` fill + `--color-neutral-04` text) instead of `opacity: 0.5`; on the PDP keep the CTA visually primary and add inline "Choose options to continue" helper text. (c) Add `variant="danger"` and replace the bordered-box-underlined-text mini-buttons in account (Change photo / Edit / Remove / Sign out / Delete) with `ghost`/`link` + `size="xs"` (and `danger` for destructive). | S each (~M total) |
| **2.5 `select-field` border to spec.** | `shared/ui/select-field.ts:119` | `--color-border-input` → `--color-neutral-04`, keep 2px, keep blue on `[aria-expanded]`. Stops the "always focused" look. | S |
| **2.6 Newsletter form uses the system.** | `features/home/newsletter-signup.ts` | Rebuild with `text-field` + `action-button` (`variant="inverse"`), or add a documented dark-surface skin to `text-field`. | S–M |
| **2.7 `empty-state` everywhere.** | `cart.ts`, `product-detail.ts` (error), `blog-list.ts` (error + empty), `verify-email.ts`, `not-found.ts` | Route these through `empty-state` with the `[action]` slot. Add an alignment prop (or a wrapper) so it can left-align inside a left-aligned page instead of always centring (A5). Resolves G10, S20, A5. | M |
| **2.8 Footer links complete.** | `shared/layout/site-footer.ts` | Add About, Privacy Policy, Terms of Service to `INFO_LINKS` (or a 3rd column); point "Support" at a real page. | S |
| **2.9 One brand name.** | `site-header.ts`, `site-footer.ts`, `admin-shell.ts`, `features/auth/*`, About page content | Standardise on "3legant." (or "3legant Golf") across wordmark, prose, admin; make the admin dot green. | S |

**Phase 2 effort:** ~6 S + 4 M.

---

## Phase 3 — Imagery & content

| Item | Files | Change | Effort |
|------|-------|--------|--------|
| **3.1 Re-image the catalogue.** | `backend/scripts/seed-data/products.ts`, `backend/scripts/seed-catalog.ts`, category seed; re-seed | **Recommended: a curated set keyed by product type.** Hand-pick one strong hero per product *type* (leather glove, rain glove, headcover, rangefinder, GPS watch, cart bag, stand bag, towel, tee pack, ball dozen, alignment stick, putting mat, polo, joggers, visor, belt, socks…) — ~25–30 images covering all 105 products, stored in Cloudinary under stable public ids, referenced from the seed by `productType`. This removes the "man swinging on a Yardage Wheel" class of error; remaining duplication is at least type-consistent. Then: add 2–4 images per product for a real PDP gallery (angle / detail / lifestyle). Also fix the 10 category-tile images (curated, one per category). As a cheaper interim: in `seed-catalog.ts` use `per_page: 15`, skip results already used (dedup `Set`), and fall back to a per-type default when a query returns nothing product-shaped. Re-evaluate `mix-blend-mode: multiply` (I8) — keep only for white-background cutouts, else drop it or gate on an `isCutout` flag. | L |
| **3.2 Rating rollup.** | backend rating projection / new backfill script; `product-purchase-panel.ts`, `product-card.ts`, `rating-stars.ts` | Recompute `product.ratingAverage` / `ratingCount` from the 249 seeded reviews (re-seed or backfill). Then make the PDP hide the stars (or show "No reviews yet") when `ratingCount === 0`, matching the card; fix the `rating-stars` aria-label to say "not yet reviewed" at 0 (X1). | S–M |
| **3.3 Coordinated promo copy.** | `features/home/sale-banner.ts:58`, `shared/layout/notification-bar.ts` | `sale-banner` sub-copy → coupon-aware or a golf-accessory line ("Save on your next round of gear"). `notification-bar` → read the same featured-coupon signal as `sale-banner` (or a single shared promo store); drop "storewide" unless the coupon truly has no minimum/scope. | S |
| **3.4 FAQ vs guest checkout.** | FAQ page content (admin) | Fix the FAQ answer to match reality (no guest checkout — account required). (Implementing real guest checkout is a separate L-sized feature, out of scope here.) | S |
| **3.5 Contact details.** | `features/contact/contact.ts` | Add a contact-info column beside the form (email, response time, links to Shipping / Returns / FAQ). | S |
| **3.6 FAQ accordion.** | `features/pages/content-page.ts` (FAQ rendering); `shared/ui/accordion-*` | Render category sections as `accordion-group`; add in-page jump-nav. | M |
| **3.7 Rendered-content link colour.** | `features/pages/content-page.ts`, `blog-post.ts` (`::ng-deep a`) | `--color-info-text` + underline for inline links. | XS |
| **3.8 Styleguide typo.** | `features/styleguide/styleguide.ts` | "lend" → "land". | XS |

**Phase 3 effort:** 1 L + 1 M + ~4 S + 2 XS.

---

## Phase 4 — Polish & states

| Item | Files | Change | Effort |
|------|-------|--------|--------|
| **4.1 Admin nav grouping.** | `admin-shell.ts` | Group the 19 items under Catalog / Commerce / Money / Content / People headings (or make the list denser + collapsible) so it fits a 900px-tall viewport and "Audit log" is reachable. | S–M |
| **4.2 `admin/inventory` pagination.** | `admin-inventory.ts` | Add `PaginationNav` + `take` param, matching the other admin lists. | S |
| **4.3 Admin filter bars.** | `admin-products.ts`, `admin-email.ts`, others; `features/admin/ui/filter-bar.ts` | Put filter controls in a horizontal `filter-bar` row, not a vertical stack. Re-verify D5 (coupon row height), D6 (order-detail label/value gap), D7 (suppression buttons) once G1 is fixed and patch any residual overflow. | S |
| **4.4 Admin default filters.** | `admin-reviews.ts` | Default to "All" (or add per-status tab counts) so a seeded store doesn't open on an empty queue. | S |
| **4.5 Seed reaches admin.** | backend seed scripts | Register seeded product images as `Media` docs; emit review / newsletter / contact / email events during seeding so Media / Newsletter / Email log / Contact inbox aren't empty on a seeded store (D4). | M |
| **4.6 Mobile shop/blog filters → drawer.** | `shop.ts`, `blog-list.ts`; reuse `drawer-panel` | Below `tablet-up`, collapse the filter sidebar behind a "Filters" button that opens a `drawer-panel`; show active-filter chips inline. | M |
| **4.7 `account-orders` mobile fix.** | `account-orders.ts` | Stack the status badge + price below the (non-wrapping) order number on narrow widths so they stop colliding (M2). | S |
| **4.8 Assistant FAB.** | `assistant-panel.ts` | Constrain so it never overlaps primary actions / form fields (bottom-inset that respects safe areas and sits clear of sticky footers), and make its route visibility deliberate — at minimum show it on storefront (home / shop / PDP), not just account (S19, M3). | S |
| **4.9 Account nav on mobile.** | `account-shell.ts` | Collapse the 7-item nav into a `<select>` or a horizontal scroller below `wide-up` (M4). | S |
| **4.10 PDP spacing + dedupe.** | `product-detail.ts`, `product-purchase-panel.ts` | Cap the gallery height and/or tighten `page-section spacing` so the buy-box and Description tab aren't separated by a void (S4). Remove the duplicated description — short summary in the buy box, full text in the tab, or vice versa (S5). Let `.purchase-row` wrap on mobile (M5). | S |
| **4.11 Account layout.** | `account-shell.ts` + pages | Widen or centre the content column, or add a two-column (form + contextual help) layout (A6). Initials-fallback avatar (A7). Style the locked email field as filled-but-disabled (A8). Add a "View details" affordance + balance the order-card row (A9). | M |
| **4.12 `order-complete`.** | `order-complete.ts` | Real next-steps / confirmation-email note; drop the seeded "DELIVERED" oddity for a placed-order context; "Continue shopping" as a button to match the cart (A10). | S |
| **4.13 Home rhythm + grids.** | `home.ts`, `notification-bar.ts`, `newsletter-signup.ts` | Break up the four dark bands (e.g. light assurance strip or light newsletter card) (G14). Balance last-row grids — centre, `auto-fit`, or fill (G15). | S |
| **4.14 `blog-post` alignment.** | `blog-post.ts` | Align the hero image to the prose column; remove the stray payment-icon row top-right (S17). Blog excerpt fade instead of hard clamp (S18). | S |
| **4.15 Perf.** | `home.ts`, `shop.ts`, `blog-list.ts`, `newsletter-signup.ts` | Mark the first product/post and hero images `priority`; give the newsletter background image `priority` or make it a CSS background (S9, §8 cross-check). | S |
| **4.16 Card badges.** | `core/services/catalog.service.ts` (`toCardProduct`) | Emit SALE (compare-at price) / NEW (recent `publishedAt`) badges so `product-card`'s badge slot is used (S11). | S |
| **4.17 a11y sweep.** | `site-header.ts`, misc | Current-page indicator in the mobile drawer nav (X3). Contrast-check any status text on dark (X5). Then run the mandated full AXE pass once Phases 1–2 land. | S |

**Phase 4 effort:** ~13 S + 4 M.

---

## Effort totals

| Phase | S | M | L | Focus |
|-------|---|---|---|-------|
| 1 — Broken layouts | 4 | 1 | – | P0 admin shell, hero, category crash, blank returns page, toasts |
| 2 — DS consistency | 6 | 4 | – | page-header, status colours, buttons, empty-state, select border, footer, brand |
| 3 — Imagery & content | ~4 (+2 XS) | 1 | 1 | catalogue re-imaging, rating rollup, promo copy, FAQ |
| 4 — Polish & states | ~13 | 4 | – | admin nav/pagination, mobile filter drawer, account layout, PDP spacing, home rhythm |
| **Total** | **~27** | **10** | **1** | |

Rough calendar estimate: Phase 1 ≈ 2–3 days, Phase 2 ≈ 1 week, Phase 3 ≈ 1–1.5 weeks (the L is asset curation), Phase 4 ≈ 1–1.5 weeks.

---

## Recommended first PR

**"Unbreak the structural defects" — three one-to-few-line changes, zero new components, zero risk:**

1. `drawer-panel.ts` → `:host { display: contents }`. Fixes every `/admin/*` page at desktop width (the P0) and de-risks the same `<drawer-panel>` inside `site-header`. Safe because the component never renders anything in place — it always portals through CDK Overlay.
2. `home.ts` `.hero` → stretch the grid child (`grid-template-columns: minmax(0,1fr)`). Re-aligns the landing-page headline with the rest of the page and moves it back onto the dark part of the scrim.
3. `toast-stack.ts` → offset below the sticky header. Stops error toasts covering the header controls.

These turn the two most damaging "this looks broken" impressions — admin unusable on every desktop screen, hero headline floating in space — into non-issues, in a PR small enough to review in minutes. Ship the `/shop?category=<slug>` fix (§1.3) and the `/account/returns/new` empty state (§1.4) as immediate fast-follows, since the first needs backend coordination and the second needs a small empty-state pass.
