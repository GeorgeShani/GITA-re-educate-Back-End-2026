# Running Gridline in production

Gridline is live at **https://gridline-data-analysis-app.duckdns.org**, on one EC2 server, started with Docker Compose.
This page is what to know to run it. How it was put there, step by step, is [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md); what each
setting means is [`ENV_SECRETS_GUIDE.md`](./ENV_SECRETS_GUIDE.md).

## What is running

| Service | What it is | Notes |
|---|---|---|
| `proxy` | Caddy, ports 80 and 443 | Gets and renews the HTTPS certificate for `SITE_ADDRESS` by itself. Sends `/api/*`, `/socket.io`, `/reference` and `/graphql` to the API and everything else to the web app. Adds the security headers. |
| `web` | The Next.js site and dashboard | Talks to the API on the private network; the browser never calls the API directly. |
| `api` | This NestJS API, port 4000 (private) | Runs the task queue and every scheduled job in the same process. |
| `migrate` | One-off | Applies new migrations, then exits. `api` waits for it. |

Outside the server: **Neon** (Postgres), a private **S3** bucket (customer files), **CloudFront** (public brand images only),
**Stripe** (test mode: card `4242 4242 4242 4242`), an **SMTP** account (mail), **Google** (sign-in) and **Gemini** (the AI summary,
only if `AI_PROVIDER=gemini`; when it is `off`, reports have no written summary and "ask in words" answers that it is unavailable).

## Is it healthy?

```bash
curl https://gridline-data-analysis-app.duckdns.org/api/health     # 200 when the API can reach Postgres
docker compose ps                                                     # migrate: exited (0); api, web, proxy: running
docker compose logs -f api                                            # one structured line per request, with a correlationId
```

`/health` checks the database only. To prove **every** third party answers, run on the server:

```bash
docker compose run --rm api node dist/ops/verify-integrations.js                     # read-only checks
docker compose run --rm api node dist/ops/verify-integrations.js --send-to you@example.com   # also sends one real email
```

It reports `PASS`, `FAIL` or `SKIP` for Postgres (and pending migrations), an S3 write/read/list/download/delete round trip, the
CloudFront logo, the SMTP login, the Stripe catalog and where its webhook posts, Google's acceptance of the client id and redirect
URI, and one Gemini query plan. It exits 1 on any `FAIL`, and masks anything that looks like a secret in what it prints. A `SKIP`
is a service switched off on purpose (for example `AI_PROVIDER=off`).

## Updating

The server follows the `main` branch by itself: `scripts/deploy.sh`, run by a systemd timer, fast-forwards to new commits, rebuilds,
waits for `/api/health`, and rolls back if the new version does not come up. Install, watch and pause it:
[`../../DEPLOYMENT.md` > Automatic updates](../../DEPLOYMENT.md). A rollback does not undo migrations, so migrations only add.

## What runs on a schedule

All of these run inside the `api` process. None runs under test.

| When (UTC) | Job | What it does |
|---|---|---|
| every 5 s | Task runner | Sends queued emails, builds reports, applies cleaning, compares versions, delivers webhooks, syncs seats and usage to Stripe. |
| 00:05 daily | Billing cycle | Rolls forward and invoices companies on the **local** engine (the Free plan, and any paid company with no Stripe subscription). Never touches a company Stripe bills, or the demo company. |
| every 15 min | Dunning | Suspends a company whose failed payment has gone `STRIPE_DUNNING_GRACE_DAYS` (7) without being paid. |
| every 6 h | Stripe catch-up | Puts a seat or usage sync that gave up back on the queue, for up to a week. |
| hourly | Idempotency janitor | Forgets request keys older than 24 h. |
| 03:43 daily | Notifications janitor | Deletes read notifications older than 90 days. |
| 04:19 daily | Webhook deliveries janitor | Deletes delivery history older than 30 days. |
| 04:27 daily | Orphan sweep | Deletes stored files no record points to (needs `s3:ListBucket`). |
| every 15 s | Socket sweep | Warns and closes live connections whose session is about to end. |

## Stripe

- The webhook endpoint is `https://gridline-data-analysis-app.duckdns.org/api/webhooks/stripe` with seven events. After any change
  to the catalog or the endpoint, run `npm run stripe:verify-catalog` (or the integration check above, which also checks the address).
- Stripe is the authority for paid plans. A Free company is billed by the local engine (it owes nothing); a paid one is billed by Stripe,
  and the app only mirrors its invoices. Do not set a paid plan by editing the database: it would have no subscription behind it.
- A company that does not pay is suspended after the grace period. Its admin can still sign in and reach **Billing** to pay; everyone
  else sees why nothing opens. Paying (or Stripe ending the subscription) lets it back in.
- Test failure paths with the cards in [`STRIPE_SETUP.md`](./STRIPE_SETUP.md).

## The data in it

- The **demo company** (`npm run seed:demo`) is read-only and has no password: **Explore the demo** starts a session for it.
- Three sample companies were added with `npm run seed:showcase` (Northwind Logistics on Basic, Meridian Clinics on Premium,
  Kavkasia Retail on Free). Their sign-ins are in `backend/.seed-credentials.local.md` on the machine that ran it, which is git-ignored.
  Delete that file and `backend/.env.production.local` when you no longer need them. Running the seed again skips what exists.

## For AI tools

- `/llms.txt` is an index of the site written for language models, and `/llms-full.txt` is every guide in one Markdown file. Both are
  built from the same list as the documentation pages, so they cannot drift from `/docs`.
- `POST /api/mcp` is the MCP server (API key with the `mcp` scope). See the MCP guide under `/docs/mcp`.

## Limits to remember

- One server: rate-limit counters and live connections are in memory, so a second API instance would need shared stores first.
- Backups are Neon's own history (how far back it goes depends on your Neon plan). Customer files are in S3 and are not versioned unless you turn that on.
- No test pipeline stands in front of the automatic deploy; a commit that does not start is rolled back, one that starts and is wrong is not.
