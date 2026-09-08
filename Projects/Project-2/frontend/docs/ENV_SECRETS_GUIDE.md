# Getting every secret the frontend needs

Companion to `backend/docs/ENV_SECRETS_GUIDE.md` — read that first if the
backend isn't running yet. This one is much shorter, because the frontend
needs almost nothing of its own.

## There is no frontend `.env`

Angular has no runtime `.env` loading. What plays the same role is
`src/environments/environment.ts` (dev) and `environment.production.ts`
(prod) — plain TypeScript files, swapped at **build time** via
`angular.json`'s `fileReplacements`, not read at request time. Whatever
value ends up in there is baked into the JS bundle and shipped to every
visitor's browser. That single fact is what decides what's allowed to go
in this file: **anything here is public**, full stop.

## TL;DR

| Value | Needed for | Get it from |
|---|---|---|
| `stripePublishableKey` | F7 checkout (Stripe Elements) | Stripe Dashboard — [below](#1-stripe-publishable-key-f7-checkout) |
| `/api` proxy target | local dev only, already set | `proxy.conf.json` — not a secret, [below](#2-the-dev-proxy-not-a-secret-already-configured) |

That's the whole list. No database URL, no API keys for third-party
services, nothing else — every real secret (Mongo, Redis, Stripe's
*secret* key, Cloudinary, Resend, Gemini) lives server-side only, per
`backend/docs/ENV_SECRETS_GUIDE.md`. The frontend only ever talks to
those services through the backend's own API.

## 1. Stripe publishable key (F7 checkout)

Stripe issues two keys as a pair: a **secret** key (`sk_test_...` /
`sk_live_...`, backend-only, already in `backend/.env` as
`STRIPE_SECRET_KEY`) and a **publishable** key (`pk_test_...` /
`pk_live_...`, meant to ship in client-side code — that's what
"publishable" means in Stripe's own naming). Stripe Elements (the
embedded card form) can't mount without it.

1. [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys) (test mode — toggle in the dashboard's left nav if you land in live mode).
2. Copy the **Publishable key** (`pk_test_...`). It's paired to the same
   account as the `sk_test_...` already in `backend/.env` — using keys
   from two different Stripe accounts will fail every payment with an
   auth error that has nothing to do with your code.
3. Paste it into `frontend/src/environments/environment.ts`:
   ```ts
   export const environment = {
     production: false,
     stripePublishableKey: 'pk_test_...',
   };
   ```

**For a real production deploy**, don't hand-edit
`environment.production.ts` with a live key and commit it — that
commits a live-mode key to git history permanently, key rotation or not.
Instead, have whatever deploys the app (a CI step, a build script) write
the real value into that file immediately before `ng build --configuration
production` runs, from a secret store the deploy pipeline already has
access to. `environment.production.ts` stays checked in with an empty
string; the deploy step is what fills it in, and only in that ephemeral
build environment.

## 2. The dev proxy (not a secret, already configured)

`frontend/proxy.conf.json` forwards `/api` to `http://localhost:3000` in
dev, wired into `angular.json`'s `serve.options.proxyConfig`. This is
what makes the app same-origin against the backend locally — which in
turn is what lets the guest-cart cookie (`gct`, `sameSite: lax`) survive
at all; a cross-origin request would silently drop it. Nothing to fill
in here — it's already pointed at the backend's default port. If the
backend runs on a different port, update the `target` in that file to
match, not an environment variable.

In a real deployment, the frontend and backend are usually served from
different origins for real, and `CORS_ORIGIN` in `backend/.env` needs to
be set to wherever the frontend is actually hosted — that's a backend
config change, not a frontend one, but worth remembering here since a
misconfigured pair between the two is the single most likely
first-deploy breakage (an API that works from Postman but not the
browser, with a CORS error in the console).
