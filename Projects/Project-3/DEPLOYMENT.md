# Deploying Gridline (backend and frontend as one app)

This guide puts the whole product on one AWS EC2 server, behind one domain with HTTPS, using the Docker setup already in the
repo. It is written for a demonstration, so every step names the cheapest sensible option, and says what to change for a real
launch.

This deployment is live at **https://gridline-data-analysis-app.duckdns.org**.

## How it fits together

`docker-compose.yml` starts four containers:

| Container | What it is |
|---|---|
| `migrate` | Runs the database migrations, then exits. `api` waits for it. |
| `api` | The backend (NestJS) on port 4000, inside the network only. |
| `web` | The frontend (Next.js) on port 3000, inside the network only. |
| `proxy` | **Caddy**: the only thing the internet can reach. It gets the HTTPS certificate and sends `/api/*`, `/socket.io`, `/reference` and `/graphql` to `api`, and everything else to `web`. |

So the browser sees **one origin**, `https://your-domain`, and there is nothing to configure for CORS. Everything else is a
service you already use, outside the server:

| Service | Used for |
|---|---|
| Neon | The Postgres database (`DATABASE_URL`, `DIRECT_URL`) |
| S3 | Customers' spreadsheets, in a private bucket |
| CloudFront + a second S3 bucket | The public logo for emails (`ASSETS_BASE_URL`) |
| Stripe | Payments |
| An SMTP service | Email. Production refuses to start with the console mailer. |

## Order of work

1. [Get a server and a fixed address](#1-an-ec2-server)
2. [Get a domain](#2-a-domain-for-a-demonstration)
3. [Create the Stripe webhook](#3-the-stripe-webhook-and-its-secret) (it needs the domain, not the server)
4. [Prepare the env files](#4-the-env-files)
5. [Install Docker and start the app](#5-install-and-start)
6. [Check it](#6-check-it)
7. [Prove every integration works](#7-prove-every-integration-works)
8. [Fill production with realistic companies](#8-fill-production-with-realistic-companies) (optional)

## What it costs, roughly

| Item | Cost |
|---|---|
| EC2 `t3.small` (2 GB) | about $15 a month, billed by the hour; stop the instance when you are not demonstrating |
| Elastic IP | free while attached to a running instance; about $3.6 a month if it is allocated but unused |
| 20 GB disk | about $2 a month |
| Domain | $0 (DuckDNS) to about $12 a year |
| Neon, Stripe test mode, S3, CloudFront | free tiers or pennies for a demo |

Set an AWS **budget alert** (Billing → Budgets) at $10 so there are no surprises.

## 1. An EC2 server

1. In the AWS console choose the region closest to you (use the same region as your S3 bucket if you can), then **EC2 → Launch
   instance**.
2. Settings:
   - **Name:** `gridline`
   - **Image:** Ubuntu Server 24.04 LTS
   - **Instance type:** `t3.small` (2 GB). A `t3.micro` (1 GB) can run the app, but building the images may run out of memory
     unless you add swap (step 5).
   - **Key pair:** create one (`.pem`). You need it to log in. Keep it safe.
   - **Storage:** 20 GB gp3.
   - **Network / security group:** create one named `gridline-web` with these inbound rules:

     | Type | Port | Source |
     |---|---|---|
     | SSH | 22 | **My IP** |
     | HTTP | 80 | Anywhere |
     | HTTPS | 443 | Anywhere |

     Do not open 3000 or 4000. Port 80 must be open even though you will use HTTPS: Caddy uses it to get the certificate.
3. Launch it.
4. **Give it a fixed address.** EC2 → **Elastic IPs** → **Allocate Elastic IP address** → select it → **Actions → Associate**
   → your instance. Without this the address changes every time the instance stops, and the domain would point nowhere.
   Note the address (for example `203.0.113.10`).
5. Test the login. On Windows, in PowerShell (use the path to your `.pem`):

```powershell
ssh -i C:\path\to\gridline.pem ubuntu@203.0.113.10
```

## 2. A domain for a demonstration

Caddy needs a real domain name to get a free HTTPS certificate (a bare IP address will not do, and Let's Encrypt does not
issue certificates for Amazon's own `ec2-….compute.amazonaws.com` names reliably). Pick one of these:

### Option A. Free: DuckDNS (best for a demo)

1. Go to <https://www.duckdns.org> and sign in with GitHub or Google.
2. In **domains**, type a name (for example `gridline-demo`) and click **add domain**. You get `gridline-demo.duckdns.org`.
3. Next to it, in **current ip**, paste your Elastic IP and click **update ip**.
4. Check it from your computer: `nslookup gridline-demo.duckdns.org` should answer with that IP.

Your `SITE_ADDRESS` is `gridline-demo.duckdns.org`.

### Option B. Cheap and tidy: buy a domain

- **Route 53** (Registered domains → Register): about $12–15 a year for `.com`, and it sits next to the rest of your AWS.
- **Cloudflare Registrar, Namecheap, Porkbun**: similar prices; `.xyz` and similar can be a dollar or two for the first year.
- The GitHub Student Developer Pack gives free domains for a year if you qualify.

Then create the DNS record: an **A record** for `app` (or `@`) pointing at the Elastic IP. In Route 53 that is a hosted zone →
**Create record** → name `app` → type `A` → value = the Elastic IP → TTL 300. If you proxy through Cloudflare, set the record
to **DNS only** (grey cloud) so Caddy can complete the certificate check.

Your `SITE_ADDRESS` is then `app.yourdomain.com`.

Wait a few minutes, then confirm with `nslookup` that the name resolves to the Elastic IP before you start the app.

## 3. The Stripe webhook and its secret

On a server, Stripe calls your backend directly, so you do **not** use `stripe listen`. Instead you register an endpoint at your
domain and use that endpoint's own signing secret.

You can do this **before** deploying: Stripe does not check that the URL answers when you create the endpoint. Doing it first
means the two values are ready when you write the env file, because the backend will not start in Stripe mode without them.

For a demonstration, stay in **test mode** (use your `sk_test_…` key and the sandbox objects you already made). No real money
moves, and the card `4242 4242 4242 4242` works.

### Create the endpoint

Use your own test key. This is the same call as in development, with this deployment's URL:

```powershell
curl.exe https://api.stripe.com/v1/webhook_endpoints -u "sk_test_YOUR_KEY:" -d "url=https://gridline-data-analysis-app.duckdns.org/api/webhooks/stripe" -d "enabled_events[]=checkout.session.completed" -d "enabled_events[]=customer.subscription.created" -d "enabled_events[]=customer.subscription.updated" -d "enabled_events[]=customer.subscription.deleted" -d "enabled_events[]=invoice.finalized" -d "enabled_events[]=invoice.payment_failed" -d "enabled_events[]=invoice.payment_succeeded"
```

(Or use the dashboard: **Developers → Webhooks → Add endpoint**, the same URL and the same seven events.)

From the response, take:

| Value | Where it is | Goes in |
|---|---|---|
| `"id": "we_…"` | the first line | `STRIPE_WEBHOOK_ENDPOINT_ID` |
| `"secret": "whsec_…"` | **only in this response**, shown once | `STRIPE_WEBHOOK_SECRET` |

Copy the secret right away. If you lose it, open the endpoint in the dashboard and use **Signing secret → Reveal**; it is
always available there.

The URL is `https://gridline-data-analysis-app.duckdns.org/api/webhooks/stripe`. The `/api` is Caddy's public prefix. It removes it, so the backend
receives `POST /webhooks/stripe`.

### Remove the development leftovers

If you made a throwaway endpoint pointing at `example.com` for local development, delete it so Stripe stops reporting failures:
dashboard → **Developers → Webhooks** → the endpoint → **Delete**, or

```powershell
curl.exe -X DELETE https://api.stripe.com/v1/webhook_endpoints/we_OLD_ID -u "sk_test_YOUR_KEY:"
```

### How it is checked

- Open `https://gridline-data-analysis-app.duckdns.org/api/webhooks/stripe` in a browser or `curl.exe -i -X POST` it. A **400** answer ("missing
  signature" or similar) is correct: the route is reachable, and it refuses anything Stripe did not sign.
- After a test payment (step 6), the endpoint's page in the Stripe dashboard shows each event with **200 OK**. A `400` there
  means the `whsec_…` in the server's env file is not this endpoint's secret.
- To resend an event, use the dashboard's **Resend** on a delivery.

### Going live later

Switch Stripe to live mode and repeat the setup there: products, prices, meter, portal configuration, a **new webhook endpoint**
(live mode has its own, with its own secret), and a live key (`sk_live_…`, ideally restricted). Run
`node --env-file=… dist/payments/verify-stripe-catalog.js` against the live values (see `backend/docs/STRIPE_SETUP.md`).

## 4. The env files

Neither file is in git, so you create them on the server. Prepare them on your computer, copy them up (step 5), and never commit
them.

### `backend/.env`

Start from `backend/.env.example` and set at least these. Generate secrets with `openssl rand -base64 48` (or
`node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`).

```
NODE_ENV=production
PORT=4000
APP_PUBLIC_URL=https://gridline-data-analysis-app.duckdns.org

# Neon: the pooled URL for the app, the direct URL for migrations
DATABASE_URL=postgresql://...-pooler...?sslmode=require&channel_binding=require
DIRECT_URL=postgresql://...?sslmode=require&channel_binding=require

# Secrets
JWT_ACCESS_SECRET=<48+ random characters, no "change-me">
DATA_ENCRYPTION_KEY=<openssl rand -base64 32>

# Files (the private bucket)
STORAGE_DRIVER=s3
AWS_REGION=<bucket region>
AWS_S3_BUCKET=gridline-bucket
AWS_ACCESS_KEY_ID=<IAM user, limited to that bucket>
AWS_SECRET_ACCESS_KEY=<same user>

# Email. Required: production refuses the console mailer. See "Email" below.
MAIL_TRANSPORT=smtp
SMTP_HOST=<smtp host>
SMTP_PORT=587
SMTP_USER=<user>
SMTP_PASSWORD=<password>
MAIL_FROM="Gridline <no-reply@gridline-data-analysis-app.duckdns.org>"

# Brand assets (the CloudFront URL, https, no trailing slash)
ASSETS_BASE_URL=https://dxxxxxxxx.cloudfront.net

# Payments (test mode for a demonstration)
PAYMENTS_PROVIDER=stripe
ALLOW_UNPAID_PLANS=false
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...            # from step 3
STRIPE_WEBHOOK_ENDPOINT_ID=we_...          # from step 3
STRIPE_BASIC_BASE_PRICE_ID=price_...
STRIPE_BASIC_SEAT_PRICE_ID=price_...
STRIPE_PREMIUM_BASE_PRICE_ID=price_...
STRIPE_PREMIUM_OVERAGE_PRICE_ID=price_...
STRIPE_FILE_METER_ID=mtr_...
STRIPE_FILE_METER_EVENT_NAME=gridline_file_uploaded
STRIPE_PORTAL_CONFIGURATION_ID=bpc_...
STRIPE_DUNNING_GRACE_DAYS=7

RATE_LIMIT_ENABLED=true
TRUST_PROXY=1
```

Compose already sets `NODE_ENV=production`, `PORT` and `TRUST_PROXY` for the containers, so those cannot be wrong. Optional:
`AI_PROVIDER=gemini` with `GEMINI_API_KEY` (otherwise reports have metrics only, and "Ask in words" is switched off), and the
three Google values if you want Google sign-in (its callback is `https://gridline-data-analysis-app.duckdns.org/api/auth/google/callback`, and it must be
listed on the OAuth client).

The backend checks all of this at start-up. If a value is missing or wrong in production, it stops and says which one.

### Email

Production needs a real SMTP service. For a demonstration:

- **Gmail:** turn on 2-step verification, create an **App password** (Google Account → Security), and use
  `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=you@gmail.com`, `SMTP_PASSWORD=<app password>`, and
  `MAIL_FROM="Gridline <you@gmail.com>"` (Gmail only sends as the account's own address). Fine for a demo, limited to a few
  hundred mails a day.
- **Resend, Brevo, Mailgun, Postmark:** free tiers, SMTP credentials provided. Better for a real launch (verify your domain
  for good deliverability).
- **Amazon SES:** the natural AWS choice. New accounts start in a sandbox where you can only send to addresses you have
  verified, which is enough to demonstrate with your own address.

EC2 blocks outbound port 25, so use 587.

### `frontend/.env`

```
API_ORIGIN=http://api:4000
```

Leave `NEXT_PUBLIC_REALTIME_URL` and `NEXT_PUBLIC_API_REFERENCE_URL` unset: behind Caddy the site's own address is right.

### `.env` at the project root (for Compose)

```
SITE_ADDRESS=gridline-data-analysis-app.duckdns.org
```

This tells Caddy which domain to get a certificate for. If it is missing, Caddy serves plain HTTP on port 3000, which is only
right for local use.

## 5. Install and start

Log in over SSH (step 1) and run:

```bash
# Docker (the official script) and permission to use it
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit        # log out and back in so the group change applies
```

After you log in again:

```bash
docker compose version     # should print a version

# If you chose a 1 GB instance, add swap first so the image builds do not run out of memory
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile

# The code. The repository root contains the project in Projects/Project-3.
git clone https://github.com/GeorgeShani/GITA-re-educate-Back-End-2026.git gridline
cd gridline/Projects/Project-3
```

If the repository is private, clone with a personal access token
(`https://<token>@github.com/GeorgeShani/GITA-re-educate-Back-End-2026.git`) or add a deploy key.

Copy the three env files from your computer. From **PowerShell on your computer**, in the project folder:

```powershell
scp -i C:\path\to\gridline.pem backend\.env ubuntu@203.0.113.10:~/gridline/Projects/Project-3/backend/.env
scp -i C:\path\to\gridline.pem frontend\.env ubuntu@203.0.113.10:~/gridline/Projects/Project-3/frontend/.env
```

and create the root one on the server:

```bash
echo "SITE_ADDRESS=gridline-data-analysis-app.duckdns.org" > .env
```

(If you would rather type the files on the server, use `nano backend/.env`.) Then lock them down:

```bash
chmod 600 .env backend/.env frontend/.env
```

Start everything:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The first build takes several minutes. What happens: images build, `migrate` applies the migrations, `api` and `web` start and pass
their health checks, `proxy` starts and asks Let's Encrypt for a certificate for your domain.

To avoid typing the two `-f` options every time, run `echo "COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml" >> .env`
once. After that, plain `docker compose up -d --build` works.

## 6. Check it

```bash
docker compose ps                      # migrate: exited (0); api, web, proxy: running / healthy
docker compose logs -f proxy           # look for "certificate obtained successfully"
curl -i https://gridline-data-analysis-app.duckdns.org/api/health # 200
```

Then in a browser:

1. `https://gridline-data-analysis-app.duckdns.org`: the marketing site, with a padlock.
2. `https://gridline-data-analysis-app.duckdns.org/reference`: the API reference.
3. Register a company. You should receive the activation email (check spam). If you do not, `docker compose logs api` shows
   the SMTP error.
4. Choose **Basic** on the billing page and pay with `4242 4242 4242 4242`, any future date, any CVC.
5. In the Stripe dashboard (test mode) → **Developers → Webhooks →** your endpoint: the events show **200**. In Gridline the
   plan changes to Basic.
6. Upload a CSV: it should appear in the S3 bucket under `companies/<id>/files/`.

Optional, for a demonstration with data already in it:

```bash
docker compose run --rm api npm run seed:demo
```

That creates the read-only "Northwind Analytics (Demo)" company, reachable from the **Explore the demo** button on the home page.

## 7. Prove every integration works

Run this on the server once the stack is up, and again after changing any key:

```bash
docker compose run --rm api node dist/ops/verify-integrations.js
# also send one real, rendered email:
docker compose run --rm api node dist/ops/verify-integrations.js --send-to you@example.com
```

It goes through the same providers the app uses and prints `PASS`, `FAIL` or `SKIP` for each line; the exit code is 1 if anything fails.

| Line | What a pass means |
|---|---|
| Postgres (Neon) | It connects and no migration is pending |
| S3 (customer files) | The bucket accepts a write, a read (same bytes), a listing, a presigned download and a delete. This is also what proves `s3:ListBucket`. |
| CloudFront | `ASSETS_BASE_URL/brand/v1/logo.png` answers 200 `image/png` |
| SMTP | The mail server accepts the login (and, with `--send-to`, delivers one email) |
| Stripe | The prices, the meter, the portal configuration and the seven webhook events exist; the webhook URL is `APP_PUBLIC_URL/api/webhooks/stripe`; the key is a test key |
| Google sign-in | The three `GOOGLE_*` values are set, the callback is `APP_PUBLIC_URL/api/auth/google/callback`, and Google knows the client id |
| Gemini | One question about a two-column sample comes back as a valid plan |
| Observe | `SKIP` without credentials; otherwise one counter is sent |

A real Google sign-in and a real payment can only be tried by a person, so walk through this list on the live domain. Use the
Stripe **test** cards.

1. **Register** with an email address. The activation email arrives, with the logo showing (it loads from CloudFront).
2. **Sign in with Google.** In Settings, link and unlink the Google account.
3. **Upload a CSV.** The object appears in S3, the report becomes ready, the AI summary is there, and the file downloads.
4. **Ask a question in words** on that file.
5. **Upgrade to Basic** with `4242 4242 4242 4242`. In Stripe → Developers → Webhooks every delivery is **200**, you come back to
   "Activating your plan" and then the plan shows Basic, and the invoice appears under Billing.
6. **Invite an employee.** The invitation email arrives; after they accept, the seat quantity on the Stripe subscription goes up.
7. **Open the Stripe portal** from Billing.
8. **Premium usage.** On a Premium test company, go past 1,000 files, or look for the meter event under Stripe → Billing → Meters.
9. **A failing payment.** Pay with `4000 0000 0000 0341`: the account becomes past due. With a short `STRIPE_DUNNING_GRACE_DAYS`
   it is suspended; the admin can still reach Billing, and paying again reactivates it.

## 8. Fill production with realistic companies

This creates three companies with people, files, second versions, quality rules, a cleaning, comments and questions, so there is
something real to look at. It is run **from your own computer**, not from the server: Neon is reachable from there, and the
uploads go through your live API, so S3, reports, quota, audit and Stripe usage all take the normal path.

| Company | Plan | People |
|---|---|---|
| Northwind Logistics (Georgia, logistics) | Basic, through Checkout | admin and 6 employees, one more invited (a real email goes out), one removed |
| Meridian Clinics (Germany, healthcare) | Premium, through Checkout | admin and 7 employees |
| Kavkasia Retail (Georgia, retail) | Free | admin only (Free has no employee seats) |

Everyone is a plus-address of one Gmail mailbox that you choose, such as `you+northwind-nino@gmail.com`: each is a separate
login, and all their mail arrives in your inbox. Passwords are 20 random characters each and are written to
`backend/.seed-credentials.local.json` and a readable `.md` beside it. Both are ignored by git. Nothing else stores them except
as hashes.

**Once, on your computer** (Node 24, the same line the Dockerfile uses):

```bash
cd Projects/Project-3/backend
npm ci && npm run build
```

Copy the server's `backend/.env` to `backend/.env.production.local` on your computer (it is ignored by git and holds secrets, so
keep it out of any sync folder and delete it when you are done). `DATABASE_URL` and `DIRECT_URL` must be the Neon ones.

**Step 1. The accounts** (creates the three companies on Free, and their admins):

```bash
npm run seed:showcase -- --stage accounts --mailbox you@gmail.com --confirm-production
```

It refuses to run against production without `--confirm-production`, and a second run creates nothing.

**Step 2. The two upgrades**, through real Checkout. Open `backend/.seed-credentials.local.md`. Sign in as the Northwind admin and
choose **Basic**; sign in as the Meridian admin and choose **Premium**. Pay with `4242 4242 4242 4242`, any future date, any CVC,
and wait until the plan shows as active. (Kavkasia stays on Free.)

**Step 3. The content:**

```bash
npm run seed:showcase -- --stage content --mailbox you@gmail.com --api https://gridline-data-analysis-app.duckdns.org/api
```

It first checks that Northwind is on Basic and Meridian on Premium through Stripe, and stops with a sentence if not. It then adds
the employees (within each plan's seat cap, with Stripe's seat count following), signs in as the real people, and uploads and
comments as them. It takes a few minutes: sign-in is limited to 10 a minute, and it waits for the reports and the cleaning,
which the running `api` container produces. Add `--skip-ai` to skip the questions put to the assistant.

If a step fails it says which and carries on; run the same command again and only what is missing is added.

**Then check:** sign in as one admin and one employee from each company and look at the files, reports, versions, the row
comparison and the comments; Stripe shows the right seat count for Northwind and the meter events for Meridian; the invitation
for Irakli Mgaloblishvili is in your Gmail inbox. Delete `backend/.seed-credentials.local.*` and `backend/.env.production.local`
when you no longer need them.

## Automatic updates

The server can follow the `main` branch by itself. `scripts/deploy.sh` fetches from GitHub, and if there is a new commit it
fast-forwards to it, rebuilds with `docker compose up -d --build` (the `migrate` service applies new migrations first), and waits
for `https://<your domain>/api/health`. If the new version never answers, it goes back to the previous commit, rebuilds that, and
remembers the bad commit so it is not retried every few minutes. A fix you push afterwards is a different commit and is deployed
normally.

It is **pull-based on purpose**: the server reaches out to GitHub, so nothing has to reach in. The security group keeps SSH open
to your own address only, which a GitHub Actions runner (a different address every time) could not use.

Install it once, on the server:

```bash
cd ~/<repository>/Projects/Project-3
git pull
sudo scripts/install-auto-deploy.sh
```

That creates a systemd timer that runs the script 3 minutes after boot and then every 2 minutes (`DEPLOY_INTERVAL=5min sudo scripts/install-auto-deploy.sh`
for another rhythm). It runs as your login user, the one that can use Docker.

| Task | Command |
|---|---|
| Watch it work | `journalctl -u gridline-deploy -f` |
| When it runs next | `systemctl list-timers gridline-deploy.timer` |
| Deploy right now | `scripts/deploy.sh` (or `--force` to rebuild the current commit) |
| Pause it (before editing files on the server) | `sudo systemctl stop gridline-deploy.timer` |
| Remove it | `sudo scripts/install-auto-deploy.sh --remove` |

Things to know:
- **The server only follows.** It never commits. If you edit a tracked file on the server, the fast-forward can fail and the script
  says so and stops; undo the edit (`git status`, `git checkout -- <file>`). Your `.env` files are not tracked, so they are safe.
- **A rollback does not undo migrations.** Migrations here only add things (a column, a table), which the previous version tolerates.
  Keep it that way, or a rollback can leave the old code running against a schema it does not know.
- **A build uses memory.** On a 1 GB instance keep the swap file from step 5, or the build can be killed mid-deploy.
- **It deploys whatever is on `main`.** Push to another branch while you work, merge when it is ready, and run the checks
  (`npm run build && npm run lint && npm test` in `backend`, `npm run lint && npm run typecheck` in `frontend`) before you merge.
- **Another branch:** `DEPLOY_BRANCH=release` in the service environment (`sudo systemctl edit gridline-deploy`).

## Day to day

| Task | Command |
|---|---|
| See what is running | `docker compose ps` |
| Follow the logs | `docker compose logs -f api` (or `web`, `proxy`) |
| Deploy a new version | automatic (see below), or by hand: `scripts/deploy.sh --force` |
| Restart one service | `docker compose restart api` |
| Change an env value | edit the file, then `docker compose up -d` (a changed `backend/.env` needs the containers recreated: `docker compose up -d --force-recreate api`) |
| Stop paying while idle | stop the EC2 instance in the console (the Elastic IP keeps its address; the domain keeps working) |
| Remove everything | `docker compose down`, then terminate the instance and **release the Elastic IP** |

## Troubleshooting

| Problem | Likely cause |
|---|---|
| The browser says the site cannot be reached | Port 80 or 443 is not open in the security group, or the domain does not point at the Elastic IP (`nslookup`) |
| Certificate error or "connection reset" at first | Caddy is still getting the certificate (watch `docker compose logs proxy`), or DNS had not propagated when it first tried. Wait a few minutes. Let's Encrypt limits repeated failures, so fix the cause before restarting repeatedly. |
| `api` keeps restarting | A production check failed. `docker compose logs api` names the variable (for example `APP_PUBLIC_URL`, `MAIL_TRANSPORT`, `DATA_ENCRYPTION_KEY`, `ASSETS_BASE_URL`). |
| `migrate` fails | Wrong `DIRECT_URL`, or Neon is asleep for a moment; run `docker compose up -d` again. |
| Stripe events show 400 | `STRIPE_WEBHOOK_SECRET` is not this endpoint's secret, or you restarted without recreating `api` after changing it |
| Stripe events show a timeout or 502 | `api` is down: `docker compose ps` and `docker compose logs api` |
| Checkout says "No such price" | The Stripe key and the price ids belong to different Stripe accounts or modes |
| No emails arrive | SMTP credentials, `MAIL_FROM` not allowed by the provider, or the message is in spam |
| Uploads fail | The IAM user lacks `s3:PutObject` on the bucket, or `AWS_REGION` is not the bucket's region |
| The nightly orphan sweep logs "Orphan sweep failed" | The IAM user also needs `s3:ListBucket` on the bucket itself (the ARN without `/*`) |
| The build is killed | Out of memory: add the swap file (step 5) or use a bigger instance |

## Before a real launch

This setup is deliberately simple. Before real customers:

- Live Stripe values and a **new** live webhook endpoint (step 3).
- A real email service with your domain verified, and a `MAIL_FROM` on that domain.
- Back up the environment files somewhere safe (a password manager). Losing `DATA_ENCRYPTION_KEY` makes stored webhook secrets
  unreadable.
- A restricted Stripe key instead of the full secret key.
- Everything runs on **one server**, and the realtime connections and rate-limit counters live in that one process. That is
  fine for a first launch; scaling to several servers needs shared state first.
- Updates are pulled by the server itself (see "Automatic updates"). There is still no test pipeline in front of them: a commit
  that does not start is rolled back, but one that starts and is wrong is deployed.
