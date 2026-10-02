import {
  type Block,
  h2,
  h3,
  note,
  p,
  steps,
  table,
  tip,
  ul,
  warn,
} from "../blocks";

export const BILLING: Block[] = [
  p(
    "Gridline has three plans. You choose one when you start, and can change it any time. The prices and limits below are the ones Gridline itself enforces, so what you read here is what happens. Only admins see **Billing**.",
  ),

  h2("The plans"),
  table(
    ["", "Free", "Basic", "Premium"],
    ["Price", "$0", "$5 per active employee per month", "$300 a month, flat"],
    ["Files per billing period", "10", "100", "1,000"],
    [
      "Past that allowance",
      "Uploads stop",
      "Uploads stop",
      "$0.50 per extra file",
    ],
    ["Employees", "None (just you)", "Up to 10", "No limit"],
    ["Quality rules", "3", "25", "No limit"],
    ["Versions of one file", "5", "50", "No limit"],
    ["Webhook endpoints", "1", "5", "No limit"],
    ["API requests per minute", "30", "120", "600"],
  ),

  h2("Choose a plan"),
  p(
    "The first time an admin signs in to a new company, Gridline asks for a plan before anything else. Until a company has one, nothing else works.",
  ),
  steps(
    {
      title: "Pick a plan",
      text: "Compare the three on the **Welcome** screen and choose one.",
    },
    {
      title: "Free: you are done",
      text: "Free needs no card and turns on at once.",
    },
    {
      title: "Basic or Premium: pay on Stripe",
      text: "You are sent to a payment page hosted by our payment provider, Stripe. You enter your card **there**, never on Gridline. The plan becomes active when Stripe confirms the payment, and not before.",
    },
  ),

  h2("Change plan"),
  p(
    "Open **Billing** and choose a different plan. Moving to a paid plan sends you to Stripe to pay. A change between paid plans starts a new billing cycle, and the cost of the part of the old period you used is settled at once. Moving to Free cancels immediately.",
  ),
  warn(
    "A change is **refused** if your company would be over the new plan's limits: more employees, rules or versions than it allows, or (leaving Premium) more files this period than the target includes. The message lists what to reduce first, so a plan change can never leave you in a state the new plan does not permit.",
  ),

  h2("See where you are"),
  p(
    "The box at the bottom of the sidebar always shows your plan and how many files you have used this billing period, for example **Basic plan, 27 / 100**. **Billing** shows the same with the period's dates and when the next invoice is cut.",
  ),
  p(
    "A billing period runs from one day of the month to the next, in UTC. Seats are the admin plus every employee who holds one.",
  ),

  h2("What you are charged"),
  h3("Basic: per active employee"),
  p(
    "$5 a month for each employee who has **accepted** their invitation and is active. A person who is invited but has not accepted, or who has been removed, is not billed. Someone active for part of a month pays for the days they were active.",
  ),
  h3("Premium: a flat fee, plus overage"),
  p(
    "$300 a month covers 1,000 files. Each extra file costs $0.50, and the extra files are reported to Stripe as they are uploaded, so your bill is never a surprise. The upload tells you the file is billed as an extra.",
  ),
  h3("The running bill"),
  p(
    "**Billing** shows what the invoice **will be** if nothing changes: itemised, with the seats, the plan fee and any extra files, and when the period ends. It is an estimate until the period closes.",
  ),

  h2("Invoices"),
  p(
    "Past invoices are listed under **Billing**, newest first. Open one to see its line items, Stripe's hosted invoice page, and a PDF. An invoice is **draft**, **open**, **paid**, **uncollectible** or **void**.",
  ),
  p(
    "To update your card or download receipts, choose the button that opens Stripe's customer portal.",
  ),

  h2("If a payment fails"),
  ul(
    "Stripe tries the payment again. Gridline marks the account past due and **starts a grace period**, seven days by default.",
    "When the grace period ends with the invoice still unpaid, the company is **suspended**: its people can no longer use the product.",
    "Admins can still sign in to read billing and open the payment portal, so they can fix it.",
    "As soon as the payment succeeds and nothing else is overdue, access is restored.",
  ),
  note(
    "Everyone who matters is told along the way: admins get an inbox entry and the billing address an email when an invoice is issued.",
  ),
  tip(
    "A banner across the top of the app tells you when the company is suspended, so nobody is left guessing.",
  ),

  h2("From code"),
  p(
    "Plans, the running bill and invoices are available over HTTP, and an `invoice.finalized` [webhook](/docs/webhooks) can feed your own finance tools: see [Company and billing API](/docs/company-api#plans-and-billing).",
  ),
];

export const ANALYTICS: Block[] = [
  p(
    "Usage analytics answer three questions: who is uploading, how much, and whether you will run out of your allowance before the period ends. Only admins see **Analytics**.",
  ),

  h2("Open the numbers"),
  steps(
    {
      title: "Choose Analytics",
      text: "In the sidebar, under **Company**.",
    },
    {
      title: "Pick the days",
      text: "By default you see the current billing period so far. Choose another range to look at an earlier one. A range can span up to a year, and days are UTC days.",
    },
  ),

  h2("What you see"),
  table(
    ["Chart", "What it tells you"],
    [
      "**Files per day**",
      "How many files were uploaded each day. A quiet day shows as zero, so the chart has no gaps.",
    ],
    [
      "**By person**",
      "Who uploaded: each person's files, bytes and last upload, most active first. People who have since been removed are still counted.",
    ],
    [
      "**Storage**",
      "What exists right now (files and bytes), and how much was uploaded in the range, including files deleted since.",
    ],
    [
      "**Quota**",
      "The **current** billing period, whatever range you chose: how many files you have used against your plan's allowance, day by day, with a line showing an even pace.",
    ],
    [
      "**Plan history**",
      "Plan changes, newest first: what changed, when, and what the outgoing plan's part-period cost.",
    ],
  ),

  h2("Are you on pace?"),
  p(
    "The pace line is where an **even** spend would be today: included files × days elapsed ÷ days in the period. If your usage runs above it, you are on course to hit your allowance early. It is the same measure the 80% and 100% alerts are about.",
  ),
  note(
    "A file you delete still counts as an upload: the upload happened, and it used your allowance. That is why the bytes uploaded in a range can be more than the bytes stored now.",
  ),

  h2("From code"),
  p(
    "The same numbers are available over HTTP, and through GraphQL for dashboards: see [Company and billing API](/docs/company-api#usage-analytics) and [GraphQL](/docs/graphql).",
  ),
];

export const AUDIT_LOG: Block[] = [
  p(
    'Every time something changes in your company, Gridline writes down who did it, what they did, to what, and when. Nobody can edit or remove those lines, not even an admin. When you need to answer "who changed that?", this is the place. Only admins see **Audit log**.',
  ),

  h2("Read the log"),
  steps(
    {
      title: "Open Audit log",
      text: "In the sidebar, under **Company**. The newest entries come first.",
    },
    {
      title: "Narrow it down",
      text: "Filter by the kind of event (for example a file was deleted), by the person who did it, by the kind of thing it was done to, or by a time window.",
    },
    {
      title: "Open an entry",
      text: "Choose any line for its details: for example the plan someone changed to, or a file's name.",
    },
  ),
  p("Each entry shows:"),
  table(
    ["Field", "Meaning"],
    [
      "**Who**",
      "The person. Empty for the system (the nightly billing run), or for a person who has since been removed.",
    ],
    ["**What**", "The action, such as `file.deleted`."],
    [
      "**To what**",
      "The kind of thing it was done to, such as a file or a person.",
    ],
    ["**When**", "The exact time."],
    [
      "**From where**",
      "The caller's address, when the change came over the web.",
    ],
    [
      "**Correlation id**",
      "Ties together every entry one request wrote, and matches that request's logs. Quote it to support.",
    ],
  ),

  h2("What is recorded"),
  table(
    ["Area", "Actions"],
    [
      "Company and account",
      "`company.registered`, `company.activated`, `company.activation_resent`, `company.updated`, `user.profile_updated`",
    ],
    [
      "Sign-in",
      "`auth.password_reset_requested`, `auth.password_reset`, `auth.password_changed`, `auth.identity_linked`, `auth.identity_unlinked`",
    ],
    [
      "People",
      "`employee.invited`, `employee.invite_resent`, `employee.accepted_invite`, `employee.disabled`, `employee.reactivated`",
    ],
    [
      "Plans and billing",
      "`subscription.created`, `subscription.changed`, `billing.checkout_started`, `billing.invoice_finalized`, `billing.payment_failed`, `billing.payment_succeeded`, `billing.company_suspended`, `billing.company_reactivated`",
    ],
    ["API keys", "`api_key.created`, `api_key.revoked`"],
    [
      "Files",
      "`file.uploaded`, `file.access_changed`, `file.deleted`, `report.rebuild_requested`",
    ],
    ["Comments", "`comment.created`, `comment.updated`, `comment.deleted`"],
    [
      "Rules",
      "`quality_rule.created`, `quality_rule.updated`, `quality_rule.deleted`",
    ],
    [
      "Webhooks",
      "`webhook_endpoint.created`, `webhook_endpoint.updated`, `webhook_endpoint.deleted`, `webhook_endpoint.secret_rotated`, `webhook_delivery.redelivered`",
    ],
  ),
  p(
    "The list is **closed**: an action that is not on it cannot be written, and an automated test checks that every action on it really is. A new feature that changes state has to add its own line here.",
  ),
  note(
    "Marking a notification as read is the one deliberate exception. It is personal inbox state, not a company action, and it would drown the log.",
  ),

  h2("You can trust it"),
  ul(
    "Each entry is written **in the same step** as the change it describes. If the change is rolled back, so is the entry: nothing is logged that did not happen, and nothing happens without a log line.",
    "The log is **append-only at the database level**: the database itself refuses to update or delete a row.",
    "Entries made by a program say so. An API key's entries carry its id, and an AI agent's say it came through MCP, so you can always tell a person from a script.",
  ),
  p(
    "New entries also appear on an admin's open screen as they happen, over a [live connection](/docs/realtime).",
  ),

  h2("From code"),
  p(
    "The log can be read over HTTP with an API key that has the audit scope: see [Company and billing API](/docs/company-api#the-audit-log).",
  ),
];

export const ACCOUNT: Block[] = [
  p(
    "Your account is you: your name, how you sign in, and the company details your admin keeps up to date. It all lives under **Settings** in the sidebar.",
  ),

  h2("Your name"),
  steps(
    {
      title: "Open Settings, then Profile",
      text: "Your name and email are shown. Your email is the address you sign in with, and where invitations were sent.",
    },
    {
      title: "Change your name",
      text: "It is the name colleagues see on your uploads and comments. Save it.",
    },
  ),

  h2("Your password"),
  steps(
    {
      title: "Open Settings, then Security",
      text: "Choose **Security** under **Settings** in the sidebar.",
    },
    {
      title: "Enter your current password",
      text: "To prove it is you.",
    },
    {
      title: "Choose a new one",
      text: "8 to 128 characters, and different from the current one.",
    },
  ),
  p(
    "Changing your password signs your other sessions out, so anyone who had got hold of an old one is out too.",
  ),
  h3("Forgot it?"),
  steps(
    {
      title: "Choose Forgot your password?",
      text: "It is on the sign-in page.",
    },
    {
      title: "Enter your email",
      text: "The answer is **always the same**, whether or not the address has an account, so nobody can use it to find out who is registered.",
    },
    {
      title: "Follow the link in the email",
      text: "Choose a new password. A link works once, and only the newest link works.",
    },
  ),
  note(
    "An account created with Google alone has no password, so there is nothing to reset. Sign in with Google.",
  ),

  h2("Sign in with Google"),
  p(
    "Anyone can use Google instead of a password: to sign in, to register a company, or to accept an invitation. Gridline identifies you by your **Google account**, never by the email address it reports. That matters:",
  ),
  ul(
    "You can accept an invitation with a personal Google account whose address differs from the one the invitation was sent to. The invitation link is itself the proof it was meant for you.",
    "Gridline will link an unknown Google account to an existing person **only** when Google vouches for the address and it matches exactly one active person. Anything doubtful never links.",
    "A Google sign-in is tied to your browser with a short-lived cookie, so another person's Google response can never sign in as you.",
  ),
  h3("Linked accounts"),
  p(
    "Under **Settings**, **Linked accounts** lists how you can sign in today (password, Google). Connect a Google account, or disconnect one. You cannot remove your **last** way to sign in.",
  ),

  h2("Company details"),
  p(
    "Admins see **Company** under **Settings**. It holds the company's **name**, **country**, **industry** and **billing email**, which is where invoices and account notices go, including the quota emails. The company is always the one you belong to.",
  ),

  h2("Activation"),
  p(
    "A new company is inactive until its admin follows the link in the activation email. If the email did not arrive, ask for another from the sign-in page. The answer is the same whether or not the address is registered.",
  ),

  h2("From code"),
  p(
    "Your profile, password, linked accounts and company details are available over HTTP: see [Company and billing API](/docs/company-api#account-and-company).",
  ),
];

export const DEMO: Block[] = [
  p(
    "Want to see Gridline before you sign up? The **demo company** is a fully populated company you can explore with one click. It is read-only, so nothing you do changes anything for anyone else.",
  ),

  h2("Open it"),
  steps(
    {
      title: "Go to the sign-in page",
      text: "Or the home page.",
    },
    {
      title: "Choose Explore the demo",
      text: "You are signed in as the demo company's admin, with no password. A banner across the top reminds you it is read-only.",
    },
  ),

  h2("What is in it"),
  ul(
    "A company on the **Basic** plan with an admin and three employees.",
    "Six CSV files with real quality reports, one of them restricted to a few people.",
    "A few quality rules, so reports show a score and a failure.",
    "An invoice and an audit trail.",
  ),
  p(
    "The files are stored and checked by the same engine as any company's. The reports are real, not mock-ups.",
  ),

  h2("What it will not do"),
  p(
    "Every change is refused, with a message that explains why: uploads, edits, invitations, plan changes, new API keys and rules. Reading is open everywhere. Buttons that would change something are hidden wherever they can be.",
  ),
  note(
    "An API key made in the demo can read but never write, and an AI agent connected to it is not even offered the tools that write.",
  ),
  tip(
    "Ready to try it for real? [Create a company](/register). Free needs no card.",
  ),

  h2("From code"),
  p(
    "Developers can open the demo from code too: `POST /auth/demo` (no body) answers with a session, exactly like signing in. See [Authentication](/docs/authentication) for what to do with it.",
  ),
];
