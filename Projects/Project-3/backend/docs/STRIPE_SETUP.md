# Setting up Stripe for Gridline

This walks through every `STRIPE_*` value in `.env`, in the order you can create them, using Stripe's **test mode** (no real
money). Stripe moves menu items around from time to time, so if a label differs slightly, look for the object name (Product,
Price, Meter, Webhook endpoint, Customer portal). The objects and their ids do not change.

Do the whole thing in test mode first. Live mode is a repeat with a second set of ids (see the last section).

## What Gridline needs from Stripe

| Variable | What it is | Looks like |
|---|---|---|
| `STRIPE_SECRET_KEY` | Your API key | `sk_test_…` |
| `STRIPE_FILE_METER_ID` | The meter that counts uploaded files | `mtr_…` |
| `STRIPE_FILE_METER_EVENT_NAME` | The name Gridline reports each file under (you choose it) | `gridline_file_uploaded` |
| `STRIPE_BASIC_BASE_PRICE_ID` | Basic plan, $0 a month | `price_…` |
| `STRIPE_BASIC_SEAT_PRICE_ID` | Basic plan, $5 a month per employee | `price_…` |
| `STRIPE_PREMIUM_BASE_PRICE_ID` | Premium plan, $300 a month | `price_…` |
| `STRIPE_PREMIUM_OVERAGE_PRICE_ID` | Premium usage: first 1,000 files free, then $0.50 each | `price_…` |
| `STRIPE_PORTAL_CONFIGURATION_ID` | The customer portal settings | `bpc_…` |
| `STRIPE_WEBHOOK_ENDPOINT_ID` | The webhook endpoint Stripe calls | `we_…` |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of that endpoint | `whsec_…` |
| `STRIPE_DUNNING_GRACE_DAYS` | Days after a failed payment before suspension | `7` |

## Step 0. A Stripe account in test mode

1. Create an account at <https://dashboard.stripe.com/register>. You do not have to activate it (add a bank account) to use
   test mode.
2. In the dashboard, switch to **test mode** (a "Test mode" toggle, or a **Sandbox**). A banner or an orange label shows it.
   Everything below is created in this mode. Test and live data never mix.

## Step 1. `STRIPE_SECRET_KEY`

1. **Developers** → **API keys**.
2. Under **Standard keys**, find **Secret key** and click **Reveal test key**. Copy the `sk_test_…` value.
3. Put it in `.env` as `STRIPE_SECRET_KEY`.

The secret key can do everything on your account. Never commit it or paste it into chat. For production, create a
**restricted key** instead (API keys → **Create restricted key**) with write access to Customers, Checkout Sessions,
Subscriptions, Invoices and Billing meter events, and read access to Prices, Products, Webhook endpoints and Customer portal
configurations.

## Step 2. The meter: `STRIPE_FILE_METER_ID` and `STRIPE_FILE_METER_EVENT_NAME`

Gridline tells Stripe about every uploaded file, and Stripe counts them for the Premium overage.

1. **Billing** → **Meters** → **Create meter** (if you do not see Meters, open **More +** or search "meters").
2. Fill in:
   - **Meter name:** `Gridline files`
   - **Event name:** `gridline_file_uploaded`. You choose this. It is your `STRIPE_FILE_METER_EVENT_NAME`, and it must match
     exactly, including case.
   - **Aggregation:** **Sum** (Gridline sends `value: 1` with every file, so Sum and Count give the same number).
   - **Value key:** `value`
   - **Customer mapping:** the default key, `stripe_customer_id`.
3. Create it. Open the meter's page and copy its id (`mtr_…`) into `STRIPE_FILE_METER_ID`. It is shown on the page and in the
   address bar.
4. Set `STRIPE_FILE_METER_EVENT_NAME=gridline_file_uploaded`.

## Step 3. The four prices

All four prices must be in **USD** and **monthly**. Gridline's catalog check refuses anything else.

Go to **Product catalog** → **Add product** for each product below. After saving a product, open it and copy the `price_…` id
of the price you made (click the price row; the id is on the right, or in the address bar).

### 3a. Basic base: `STRIPE_BASIC_BASE_PRICE_ID`

- Product name: `Gridline Basic`
- Pricing model: **Flat rate**; price **$0.00**; **Recurring**; billing period **Monthly**.
- This is the "anchor" item of a Basic subscription. It costs nothing.

### 3b. Basic seat: `STRIPE_BASIC_SEAT_PRICE_ID`

- Add a second price to the same product (or a product named `Gridline Basic seat`).
- Pricing model: **Flat rate** ("per unit"); price **$5.00**; **Recurring**; **Monthly**.
- Gridline sets the quantity to the number of active employees.

### 3c. Premium base: `STRIPE_PREMIUM_BASE_PRICE_ID`

- Product name: `Gridline Premium`
- Flat rate **$300.00**; **Recurring**; **Monthly**.

### 3d. Premium overage: `STRIPE_PREMIUM_OVERAGE_PRICE_ID`

- On the Premium product, **Add another price**.
- Choose **Recurring**, then the **Usage-based** pricing model, and select the meter you made in step 2.
- Pricing: **Graduated** (tiered, graduated pricing). Two tiers:

| Tier | First unit | Last unit | Price per unit | Flat fee |
|---|---|---|---|---|
| 1 | 1 | 1000 | $0.00 | $0.00 |
| 2 | 1001 | ∞ | $0.50 | $0.00 |

- Billing period: **Monthly**.

This is exactly the rule "1,000 files included, then 50 cents a file". The verify script checks these tiers.

## Step 4. The customer portal: `STRIPE_PORTAL_CONFIGURATION_ID`

The portal is the Stripe-hosted page where a customer updates their card and reads invoices. Gridline wants it to do only
that, so plan changes always go through Gridline.

1. **Settings** (gear icon) → **Billing** → **Customer portal** (search "customer portal" if the path differs).
2. Set:
   - **Payment methods → Allow customers to update payment methods:** on
   - **Invoice history → Allow customers to view invoice history:** on
   - **Subscriptions → Cancel subscriptions:** **off**
   - **Subscriptions → Update subscriptions:** **off**
3. Save.

The configuration id (`bpc_…`) is not always shown in the page. Get it with the API (replace the key):

```bash
curl https://api.stripe.com/v1/billing_portal/configurations -u sk_test_YOUR_KEY:
```

Look for `"id": "bpc_…"`. If you have more than one configuration, use the one where `payment_method_update` and
`invoice_history` are `enabled: true` and the other two are `false`. Note the colon after the key: it is how curl sends
the key with an empty password.

If you would rather create the configuration without the dashboard, this makes exactly the right one and prints its id:

```bash
curl https://api.stripe.com/v1/billing_portal/configurations -u sk_test_YOUR_KEY: \
  -d "business_profile[headline]=Gridline billing" \
  -d "features[payment_method_update][enabled]=true" \
  -d "features[invoice_history][enabled]=true" \
  -d "features[subscription_cancel][enabled]=false" \
  -d "features[subscription_update][enabled]=false"
```

## Step 5. The webhook: `STRIPE_WEBHOOK_ENDPOINT_ID` and `STRIPE_WEBHOOK_SECRET`

Stripe calls Gridline when a checkout finishes, a subscription changes, or an invoice is issued or paid. Gridline's route is
`POST /webhooks/stripe` (behind Caddy it is public as `/api/webhooks/stripe`).

### 5a. On a deployed server (a public HTTPS address)

1. **Developers** → **Webhooks** → **Add endpoint** (or **Add destination** → **Webhook endpoint**).
2. **Endpoint URL:** `https://gridline-data-analysis-app.duckdns.org/api/webhooks/stripe`
3. **Events to send**, exactly these seven (Stripe's picker has a search box):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.finalized`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Create it. Open the endpoint:
   - **Signing secret → Reveal** → `whsec_…` → `STRIPE_WEBHOOK_SECRET`
   - The endpoint id `we_…` is in the address bar and in the page's details → `STRIPE_WEBHOOK_ENDPOINT_ID`

Gridline verifies every call against the signing secret, so a wrong secret means every webhook is rejected with a 400.

### 5b. On your own computer (no public address)

Stripe cannot reach `localhost`, so use the Stripe CLI to forward events.

1. Install the Stripe CLI (<https://docs.stripe.com/stripe-cli>) and run `stripe login`.
2. Start forwarding:

```bash
stripe listen --forward-to localhost:4000/webhooks/stripe
```

3. It prints `Ready! … Your webhook signing secret is whsec_…`. Use that as `STRIPE_WEBHOOK_SECRET`. It belongs to
   this listening session and the CLI prints the same one each time you run it on the same login.
4. `STRIPE_WEBHOOK_ENDPOINT_ID` is only used by the verify script. The CLI has no endpoint, so create a throwaway one:
   **Developers → Webhooks → Add endpoint**, URL `https://example.com/api/webhooks/stripe`, with the same seven events, and
   copy its `we_…` id. It will never be called; it only has to exist and be enabled.
5. Keep `stripe listen` running while you test. Trigger a real flow (a checkout) and watch events arrive in that terminal.

## Step 6. `STRIPE_DUNNING_GRACE_DAYS`

Not a Stripe object. It is how many days after a failed payment Gridline waits before suspending a company. Leave `7`, or
set 1 to 30. In Stripe, **Settings → Billing → Subscriptions and emails → Manage failed payments** controls how many times
and when Stripe retries the card; pick a retry schedule that fits inside the same number of days.

## Step 7. Put it together

`backend/.env`:

```
PAYMENTS_PROVIDER=stripe
ALLOW_UNPAID_PLANS=false
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_WEBHOOK_ENDPOINT_ID=we_...
STRIPE_BASIC_BASE_PRICE_ID=price_...
STRIPE_BASIC_SEAT_PRICE_ID=price_...
STRIPE_PREMIUM_BASE_PRICE_ID=price_...
STRIPE_PREMIUM_OVERAGE_PRICE_ID=price_...
STRIPE_FILE_METER_ID=mtr_...
STRIPE_FILE_METER_EVENT_NAME=gridline_file_uploaded
STRIPE_PORTAL_CONFIGURATION_ID=bpc_...
STRIPE_DUNNING_GRACE_DAYS=7
```

Also set `APP_PUBLIC_URL` to the address people use for the website (`http://localhost:3000` in development). Stripe sends
customers back to `${APP_PUBLIC_URL}/billing` after checkout and after the portal. Restart the backend afterwards.

## Step 8. Check it

```bash
cd backend
npm run stripe:verify-catalog
```

Success prints `Stripe catalog verified.` Otherwise it names the first problem:

| Message | Fix |
|---|---|
| `Basic base price must be a licensed $0 monthly price.` | The price is not $0, not monthly, or not a flat-rate price |
| `Basic seat price must be a licensed $5 monthly price.` | Price is not $5.00 monthly flat rate |
| `Premium base price must be a licensed $300 monthly price.` | Price is not $300.00 monthly flat rate |
| `Premium usage must be graduated: first 1000 free, then $0.50 per file.` | Check the two tiers (1–1000 at $0, 1001–∞ at $0.50), graduated, metered |
| `The Stripe meter event name does not match STRIPE_FILE_METER_EVENT_NAME.` | The meter's event name and your env value differ (case counts) |
| `Stripe webhook endpoint is missing: …` | Add the listed events to the endpoint |
| A validation error mentioning `active`, `enabled` or `status` | The price is archived, the meter is inactive or the endpoint disabled, or the portal settings are not as in step 4 |
| `… is required.` | An env value is empty |

## Step 9. Try a payment

1. Start the backend, the frontend and (for local development) `stripe listen`.
2. Register a company, choose **Basic** on the billing page, and use Stripe's test card **4242 4242 4242 4242**, any future
   expiry, any CVC and any postcode.
3. After checkout, the dashboard's plan should show Basic. In the Stripe dashboard (test mode) you should see the customer,
   a subscription with two items, and the webhook events as delivered.
4. Useful test cards: `4000 0000 0000 0341` (attaches, then payment fails: tests suspension) and
   `4000 0000 0000 9995` (insufficient funds). Stripe's **test clocks** (Billing → Test clocks) let you skip forward a
   month to see the next invoice.

## Going live

Repeat steps 1 to 5 with test mode switched off. Live mode has its own products, prices, meter, portal configuration and
webhook endpoint, so every id is different. Use live keys (`sk_live_…`, preferably a restricted key) and the live endpoint's
signing secret, then run `npm run stripe:verify-catalog` against the live values. `APP_PUBLIC_URL` must be your real
HTTPS address, and `ALLOW_UNPAID_PLANS` stays `false`.
