import {
  BASE,
  type Block,
  code,
  endpoint,
  fields,
  h2,
  note,
  p,
  tabs,
  tip,
  ul,
  warn,
} from "../blocks";

export const BILLING_REF: Block[] = [
  p(
    "Gridline has three plans. You choose one when you start, and can change it any time. The prices and limits below are the ones the API itself enforces, so what you read here is what happens.",
  ),

  h2("Read the plans"),
  p(
    "The same table is available as data at `GET /subscriptions/plans`, which needs no sign-in, so a pricing page can read it directly.",
  ),

  h2("Choose a plan"),
  endpoint("POST", "/subscriptions/me", "Admins. Your first plan."),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/subscriptions/me \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "plan": "basic" }'`,
    },
    {
      label: "JavaScript",
      code: `const response = await fetch("${BASE}/subscriptions/me", {
  method: "POST",
  headers: { Authorization: \`Bearer \${accessToken}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ plan: "basic" }),
});
const result = await response.json();
if (response.status === 202) window.location.href = result.checkoutUrl; // paid plan`,
    },
  ),
  ul(
    "**Free** turns on immediately (`201`).",
    "**Basic and Premium** answer `202` with a `checkoutUrl`: a page hosted by our payment provider, Stripe. You enter your card **there**, never on Gridline. The plan becomes active when Stripe confirms the payment, and not before.",
  ),
  p(
    'Until a company has a plan, every feature answers `402 Payment Required` with "No plan selected yet".',
  ),

  h2("Change plan"),
  endpoint("PATCH", "/subscriptions/me", "Admins. Supports Idempotency-Key."),
  p(
    "Same body as above. Moving to a paid plan sends you to Checkout; a change between paid plans starts a new billing cycle, and the cost of the part of the old period you used is settled at once; moving to Free cancels immediately.",
  ),
  warn(
    "A change is **refused** if your company would be over the new plan's limits: more employees, rules or versions than it allows, or (leaving Premium) more files this period than the target includes. The answer lists what to reduce first, so a plan change can never leave you in a state the new plan does not permit.",
  ),

  h2("See where you are"),
  endpoint(
    "GET",
    "/subscriptions/me",
    "Anyone signed in, or a key with files:read.",
  ),
  code(
    `{
  "plan": "basic",
  "billingAnchorDay": 14,
  "period": { "start": "2026-10-14T00:00:00.000Z", "end": "2026-11-14T00:00:00.000Z", "key": "2026-10-14", "days": 31 },
  "limits": { "maxEmployees": 10, "maxSeats": 11, "filesPerPeriod": 100 },
  "usage": { "files": 37, "employees": 4, "seats": 5 },
  "nextDueDate": "2026-11-14T00:00:00.000Z"
}`,
    "Response",
  ),
  p(
    "Seats are the admin plus every employee who holds one. A billing period runs from one day-of-month to the next, in UTC.",
  ),

  h2("The running bill"),
  endpoint("GET", "/billing/current", "Admins. Needs billing:read for a key."),
  p(
    "Shows what the invoice **will be** if nothing changes: itemised in cents, with the seats, the plan fee and any overage, and when the period ends. It is an estimate until the period closes.",
  ),

  h2("Invoices"),
  ul(
    "`GET /billing/invoices`: past invoices, newest first.",
    "`GET /billing/invoices/{id}`: one invoice with its line items, a link to Stripe's hosted invoice page, and its PDF.",
  ),
  p(
    "An invoice's `status` is one of `draft`, `open`, `paid`, `uncollectible` or `void`. All money in the API is in **integer cents**, never decimals.",
  ),
  p(
    "To update your card or download receipts, `POST /billing/portal-session` returns a link to Stripe's customer portal.",
  ),

  tip(
    "Watch the `invoice.finalized` [webhook](/docs/webhooks) to feed invoices into your own finance tools. What happens when a payment fails is explained in [Plans and billing](/docs/billing).",
  ),
];

export const ANALYTICS_REF: Block[] = [
  p(
    "Usage analytics answer three questions: who is uploading, how much, and whether you will run out of quota before the period ends. Admins read them; the dashboard draws them, and the API gives you the numbers.",
  ),

  h2("Get the numbers"),
  endpoint(
    "GET",
    "/analytics/usage",
    "Admins only. API keys cannot use this endpoint; GraphQL offers the same numbers to dashboards.",
  ),
  fields(
    {
      name: "from",
      type: "date",
      text: "First day, inclusive. Default: the first day of the current billing period.",
    },
    {
      name: "to",
      type: "date",
      text: "Last day, **exclusive**. Default: through today. At most 366 days after `from`.",
    },
  ),
  p(
    "Days are UTC days. With neither parameter you get the current billing period so far.",
  ),
  code(
    `curl "${BASE}/analytics/usage?from=2026-10-01&to=2026-11-01" \\
  -H "Authorization: Bearer ACCESS_TOKEN"`,
    "curl",
  ),

  h2("What comes back"),
  fields(
    {
      name: "range",
      type: "object",
      text: "The days the numbers cover (`from`, `to`, `days`).",
    },
    {
      name: "filesPerDay",
      type: "array",
      text: "One point per day: `date` and `files`. A quiet day is `0`, so every day has a point and a chart needs no gap-filling.",
    },
    {
      name: "byEmployee",
      type: "array",
      text: "Who uploaded: `fullName`, `files`, `bytes` and `lastUploadAt`, most active first. People who have since been removed are still counted.",
    },
    {
      name: "storage",
      type: "object",
      text: "`liveFiles` and `liveBytes` (what exists right now, ignoring the range), and `uploadedBytesInRange` (including files deleted since).",
    },
    {
      name: "quota",
      type: "object",
      text: "The **current** billing period, whatever the range: the plan, `limit`, `used`, and a `points` list with, for each day, `used` so far and `pace`.",
    },
    {
      name: "planHistory",
      type: "array",
      text: "Plan changes, newest first, up to 50: what changed, when, and what the outgoing plan's part-period cost in cents.",
    },
  ),

  h2("Are you on pace?"),
  p(
    "`pace` is where an **even** spend would be today: included files × days elapsed ÷ days in the period. If `used` runs above `pace`, you are on course to hit your quota early. It is the same number the quota alerts at 80% and 100% are about.",
  ),
  note(
    "A file you delete still counts as an upload: the upload happened, and it used your quota. That is why `uploadedBytesInRange` can exceed `liveBytes`.",
  ),
];
