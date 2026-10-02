import { type Block, h2, note, p, table, tip, ul } from "../blocks";

export const LIMITS: Block[] = [
  p(
    "Every number Gridline enforces, in one place. Plan limits are checked by the API itself, so these are exactly what you will meet.",
  ),

  h2("By plan"),
  table(
    ["", "Free", "Basic", "Premium"],
    ["Price", "$0", "$5 per active employee per month", "$300 a month, flat"],
    ["Files per billing period", "10", "100", "1,000"],
    [
      "Past the file quota",
      "Uploads refused (402)",
      "Uploads refused (402)",
      "$0.50 per extra file",
    ],
    ["Employees", "0", "10", "No limit"],
    ["Quality rules", "3", "25", "No limit"],
    ["Versions of one file", "5", "50", "No limit"],
    ["Webhook endpoints", "1", "5", "No limit"],
    ["API requests per minute (whole company)", "30", "120", "600"],
  ),

  h2("Files"),
  table(
    ["", "Limit"],
    ["Formats", "CSV, XLS, XLSX"],
    ["Size of an upload", "25 MB"],
    [
      "Size of an upload through an AI agent",
      "8 MB (larger files use `POST /files`)",
    ],
    ["A download link lives", "5 minutes"],
    ["Profiled in one report", "The first 100,000 rows and 200 columns"],
    ["Preview", "First 50 rows × 50 columns, cells cut at 200 characters"],
    [
      "Expanded size of an XLSX",
      "200 MB (a guard against files that blow up when opened)",
    ],
    ["Files you may grant access to", "100 people per file"],
  ),

  h2("People and keys"),
  table(
    ["", "Limit"],
    ["Password length", "8 to 128 characters"],
    ["Access token lifetime", "15 minutes"],
    ["Refresh token lifetime", "30 days, and single use"],
    ["Active API keys per person", "25"],
    ["Comment length", "5,000 characters"],
    ["People mentioned in one comment", "50"],
    ["Unique-value rules per company", "10 (on every plan)"],
  ),

  h2("Requests"),
  table(
    ["", "Limit"],
    ["Items per page", "1 to 100 (default 20)"],
    ["Sign-in attempts", "10 a minute per address"],
    ["Forgot password, resend activation", "5 a minute per address"],
    ["Plan changes", "10 a minute, in their own budget"],
    ["Idempotency keys are remembered for", "24 hours"],
    ["Analytics range", "At most 366 days"],
    ["GraphQL depth / cost / page size", "6 / 1,000 / 50"],
  ),

  h2("Live connections and webhooks"),
  table(
    ["", "Limit"],
    ["Files watched per connection", "20"],
    ["Watch commands", "20 per 10 seconds per connection"],
    ["Typing events", "5 per second"],
    ["Webhook delivery attempts", "5, with a growing delay"],
    ["Failed deliveries before an endpoint is disabled", "20 in a row"],
    ["Delivery history kept", "30 days"],
  ),

  h2("How long things are kept"),
  table(
    ["What", "Kept"],
    ["Read notifications", "90 days (unread ones stay)"],
    ["Webhook delivery history", "30 days"],
    ["Idempotency records", "24 hours"],
    ["The audit log", "Permanently: it cannot be edited or removed"],
    ["Files, reports and comments", "Until deleted"],
  ),
  tip(
    "Need a higher limit than your plan gives? Compare plans in [Plans and billing](/docs/billing).",
  ),
];

export const SECURITY: Block[] = [
  p(
    "A company hands Gridline its spreadsheets, so how they are kept safe is part of the product. This page says plainly what Gridline does, so you can judge it, in the same simple language as everything else.",
  ),

  h2("Companies are kept apart"),
  ul(
    "Everything Gridline stores belongs to one company, and every read and write is limited to the company of the person asking.",
    "The company comes from **who you are**, never from the request. You cannot ask for another company's data by sending its id: a request that tries is simply refused.",
    'Another company\'s data is not "forbidden", it is `404`. Nothing reveals that it exists.',
  ),

  h2("People are kept apart, too"),
  ul(
    "Inside a company, a restricted file is visible only to its uploader, admins and the people it is shared with. One rule decides this everywhere: lists, reports, downloads, comments, GraphQL, live updates and AI agents.",
    "Your role and your company's status are read fresh on every request, so removing someone or suspending a company works immediately, with no token to wait out.",
    "Sign-in, password reset and activation never reveal whether an email address has an account.",
  ),

  h2("Passwords and tokens"),
  ul(
    "Passwords are stored with **scrypt**, a deliberately slow function. Gridline never stores a password, or anything that could be turned back into one.",
    "One-time links (activation, invitation, password reset) and refresh tokens are random, and only a **hash** is stored. A link works once.",
    "Refresh tokens **rotate**. Using an old one again is treated as theft and ends the session.",
    "API keys are shown once and stored as a hash. A leaked key can be revoked, and it can never mint a new key or reach account settings.",
    "Access tokens carry only who you are, are pinned to one signing algorithm, and expire after 15 minutes.",
  ),

  h2("Your files"),
  ul(
    "Files live in a **private** storage bucket. They are never served through a public address. A download is a link that works for **5 minutes**, handed out only after the access check.",
    "Gridline decides what a file is from its **bytes**, so a disguised program is refused whatever it is named.",
    "Files are read by a profiler with limits (rows, columns, and a guard against files that expand enormously), so one bad file cannot take the service down.",
    "Legacy `.xls` files are stored but not profiled, because the only parsers for that format have a history of security problems.",
  ),

  h2("What the AI sees"),
  p(
    "If a plain-language summary is switched on, the model is shown **aggregates only**: column names, counts, percentages, and the **average** of a numeric column. It never sees a row or a cell value, and it is told to treat column names as data, not instructions. A failed or unavailable model never stops a report.",
  ),

  h2("Payments"),
  ul(
    "Card details are entered **only** on Stripe's hosted pages. Gridline never sees or stores a card number.",
    "Stripe's own events change your plan, after Gridline verifies their signature. A payment event cannot be replayed or applied twice.",
  ),

  h2("Webhooks"),
  ul(
    "Every delivery is signed with HMAC-SHA256 over the timestamp and the exact body, so a receiver can prove it came from Gridline and reject replays.",
    "Secrets are encrypted at rest.",
    "Every attempt re-resolves the address, refuses private and internal networks, pins the checked address for the connection, and never follows redirects.",
  ),

  h2("A record you can trust"),
  ul(
    "Every change writes an audit entry in the same step as the change. The table is append-only at the database level.",
    "Logs redact tokens, one-time links and secrets, and every line carries a correlation id so a problem can be traced end to end.",
  ),

  h2("Throttling"),
  p(
    "Requests are limited per company, and sensitive actions (sign-in, reset, registration) have small limits of their own per address. Sign-in does the same amount of work for a wrong password as for an unknown email, so timing reveals nothing.",
  ),
  note(
    "Found something that looks wrong? Please tell us. Quote the `correlationId` from the response if you have one.",
  ),
];

export const TROUBLESHOOTING: Block[] = [
  p(
    "Most problems have one of a few causes. Find what you are seeing below. Every error also carries a `correlationId`: if none of this helps, quote it when you ask for help.",
  ),

  h2("My request was refused"),
  table(
    ["You see", "Likely cause", "What to do"],
    [
      '`401` "Invalid email or password"',
      "Wrong password, or no account for that address.",
      "Check both. Use **Forgot your password?** if needed. The message is the same for both on purpose.",
    ],
    [
      "`401` on every call",
      "The token is missing, expired (15 minutes) or revoked.",
      "Sign in again, or [refresh the session](/docs/authentication). For a key: is it revoked, or was its owner removed?",
    ],
    [
      '`403` "not activated yet"',
      "The activation link has not been used.",
      "Open the link in the email, or ask for a new one: `POST /auth/resend-activation`.",
    ],
    [
      '`403` "lacks the required scope: files:write"',
      "The API key was made without that scope.",
      "Make a new key with the scope. Scopes cannot be added to an existing key.",
    ],
    [
      '`403` "API keys cannot be used with this endpoint"',
      "That endpoint is closed to keys by design.",
      "Use a signed-in session. See [API keys](/docs/api-keys).",
    ],
    [
      '`403` "read-only demo"',
      "You are in the demo company.",
      "[Create your own company](/register) to make changes.",
    ],
    [
      "`403` suspended",
      "A payment failed and the grace period ended.",
      "An admin can sign in and pay in **Billing**. Access returns when it is paid.",
    ],
    [
      '`402` "No plan selected yet"',
      "The company has not chosen a plan.",
      "An admin chooses one: `POST /subscriptions/me`.",
    ],
    [
      "`402` about your plan allowing N files",
      "You reached the file quota on Free or Basic.",
      "Wait for the reset date in the message, or upgrade: `PATCH /subscriptions/me`.",
    ],
    [
      "`404` for something you know exists",
      "You may not see it, or it belongs to another company.",
      "Ask the uploader or an admin to share it. Gridline cannot tell you which.",
    ],
    [
      "`409` about plan limits",
      "You hit a limit on people, rules, versions or webhook endpoints.",
      "Remove one, or upgrade. See [Limits](/docs/limits).",
    ],
    ["`413`", "The file is over 25 MB.", "Split it, or export it as CSV."],
    [
      "`422` on an Idempotency-Key",
      "The same key was used for a different request.",
      "Make a new UUID for each distinct request.",
    ],
    [
      "`429`",
      "The company used its requests for this minute.",
      "Wait for `Retry-After`. See [Rate limits](/docs/rate-limits).",
    ],
  ),

  h2("My upload or report is not working"),
  table(
    ["You see", "Likely cause", "What to do"],
    [
      '`400` "Only CSV, XLS and XLSX spreadsheets are accepted"',
      "The bytes are not a spreadsheet, whatever the name says. A CSV with unusual control characters can also trip this.",
      "Re-export it as CSV or XLSX.",
    ],
    [
      "Report stays `queued`",
      "The background worker has a backlog.",
      "Wait a little, then check again. Transient problems retry automatically.",
    ],
    [
      "Report `failed`",
      "The file itself is unreadable: corrupt, unclosed quote, or too large when expanded.",
      "Read `errorMessage`. Fix the file and upload it as a new version.",
    ],
    [
      "Report `unsupported`",
      "A legacy `.xls` file.",
      "Save it as `.xlsx` or CSV to get a report.",
    ],
    [
      "`qualityScore` is `null`",
      "No rule applied to this file.",
      "Add rules, or check the column names they use (matching ignores case).",
    ],
    [
      "Preview or comparison answers `409`",
      "A report is still being built.",
      "Ask again in a moment.",
    ],
    [
      "A new version was refused with `409`",
      "Your plan's limit on versions of one file.",
      "Delete an old version or upgrade.",
    ],
  ),

  h2("Email and sign-in"),
  table(
    ["You see", "Likely cause", "What to do"],
    [
      "No activation or reset email",
      "It is in spam, or the address is wrong. The answer is the same either way.",
      "Check spam, then ask again. Reset links work once and only the newest works.",
    ],
    [
      '"This invitation link is invalid"',
      "It was used, replaced by a newer invitation, or expired.",
      "Ask your admin to resend it.",
    ],
    [
      "Google says the sign-in expired",
      "It started in a different browser, or took too long.",
      "Start again from the sign-in page, in one browser.",
    ],
    [
      "Google sign-in did not join my account",
      "Gridline links only when Google vouches for an address that matches one active person.",
      "Sign in with your password, then connect Google from **Settings → Linked accounts**.",
    ],
    [
      '"An account with this email already exists"',
      "One login email is one account.",
      "Use a different address for the second company, or sign in.",
    ],
    [
      "My API key stopped working",
      "It was revoked, its owner was removed or demoted, or it lacks a scope that an admin-only change removed.",
      "Check **Developers → API keys**. Make a new key if needed.",
    ],
  ),

  h2("Webhooks and live updates"),
  table(
    ["You see", "Likely cause", "What to do"],
    [
      "No webhooks arrive",
      "The endpoint is disabled (20 failed deliveries, or a `410`), or it is subscribed to other events.",
      "`GET /outgoing-webhooks` shows `active`. Fix the receiver and set `active: true`.",
    ],
    [
      "Signature check fails",
      "You signed a parsed or changed body, or used an old secret.",
      "Sign the **raw** body with the current `whsec_…` secret. See [Webhooks](/docs/webhooks).",
    ],
    [
      "The same event arrives twice",
      "Delivery is at least once.",
      "Skip repeats using the `webhook-id` header.",
    ],
    [
      "The live connection is refused",
      "You sent an API key, or the token expired.",
      "Connect with a fresh **access token**.",
    ],
  ),
  tip(
    "Still stuck? The [API reference](/reference) lists every endpoint, parameter and response, and is generated from the code, so it is always current.",
  ),
];
