import {
  BASE,
  type Block,
  code,
  endpoint,
  fields,
  h2,
  h3,
  note,
  p,
  table,
  tabs,
  tip,
  ul,
  warn,
} from "../blocks";

export const AUTHENTICATION: Block[] = [
  p(
    "Every request to Gridline says who is asking, in one header: `Authorization: Bearer <token>`. There are two kinds of token, for two kinds of caller.",
  ),
  table(
    ["", "A session", "An API key"],
    [
      "For",
      "A person using the dashboard, or your own app signing someone in",
      "A script, a server or an AI agent",
    ],
    [
      "Looks like",
      "A long token that expires in 15 minutes",
      "`gl_live_…`, valid until revoked",
    ],
    [
      "Can reach",
      "Everything the person's role allows",
      "Only what its scopes allow, never more than its owner",
    ],
    ["Made by", "Signing in", "A person, in Developers → API keys"],
  ),
  tip("Building an integration? Use an API key. Sessions are for people."),

  h2("Sign in"),
  endpoint("POST", "/auth/login", "Public. 10 attempts a minute per address."),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "nino@acme.com", "password": "a long passphrase" }'`,
    },
    {
      label: "JavaScript",
      code: `const session = await (
  await fetch("${BASE}/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nino@acme.com", password: "a long passphrase" }),
  })
).json();`,
    },
  ),
  code(
    `{
  "accessToken": "eyJhbGciOi…",
  "refreshToken": "q3Zk…",
  "tokenType": "Bearer",
  "expiresIn": 900
}`,
    "Response",
  ),
  ul(
    "`accessToken` is what you send in the `Authorization` header. It lasts `expiresIn` seconds (15 minutes).",
    "`refreshToken` is what you keep, to get a new access token without asking for the password again. It lasts 30 days.",
  ),
  h3("When sign-in is refused"),
  table(
    ["Answer", "Meaning"],
    [
      "`401`",
      '"Invalid email or password." It is the same answer for a wrong password and for an address that has no account, on purpose.',
    ],
    [
      "`403`",
      "The password was right but the account cannot sign in: it is not activated yet, it was disabled, or its company is not active.",
    ],
    ["`429`", "Too many attempts from this address. Wait a minute."],
  ),

  h2("Keep a session alive"),
  endpoint("POST", "/auth/refresh", "Public."),
  p("When the access token expires, trade the refresh token for a new pair:"),
  code(
    `curl ${BASE}/auth/refresh \\
  -H "Content-Type: application/json" \\
  -d '{ "refreshToken": "q3Zk…" }'`,
    "curl",
  ),
  warn(
    "A refresh token works **once**. The answer contains a new one, and you must save it and throw the old one away. If a token that has already been used is shown again, Gridline assumes it was copied and **ends the whole session**, for the thief and the owner alike. So never refresh from two places with the same token at once.",
    "Refresh tokens rotate",
  ),

  h2("Sign out"),
  endpoint("POST", "/auth/logout", "Send the refreshToken."),
  p(
    "Ends that session immediately. The access token still expires on its own clock.",
  ),

  h2("Other ways to sign in"),
  ul(
    "**Google.** `POST /auth/oauth/google/url` returns the Google address to send the person to. When they return, you trade a one-time code at `POST /auth/oauth/exchange`. See [Your account](/docs/account).",
    "**An invitation.** `POST /auth/accept-invite` with the emailed `token` and a `password` creates the person's login and signs them in.",
  ),

  h2("Your role is checked every time"),
  p(
    "A token says who you are, **not what you may do**. On every request Gridline reads your role, your status and your company's status from the database. If an admin demotes you, removes you, or the company is suspended, your very next request reflects it. There is no list of revoked tokens to wait on.",
  ),

  h2("If something is wrong with the token"),
  table(
    ["Answer", "Meaning"],
    [
      "`401`",
      "No token, a bad or expired token, a revoked API key, or the owner is gone. The message is deliberately the same for all of these.",
    ],
    [
      "`403`",
      "The token is fine but not allowed here: the role is too low, the API key lacks a scope, or the company is suspended.",
    ],
  ),
];

export const API_KEYS: Block[] = [
  p(
    "An API key lets a program act as you. It is the right tool for scripts, servers, integrations and AI agents. This guide shows how to make one, what it can be allowed to do, and how it stays safe.",
  ),

  h2("Create a key"),
  endpoint("POST", "/api-keys", "Needs a session. A key cannot make keys."),
  fields(
    {
      name: "name",
      type: "string",
      required: true,
      text: "What it is for, so you can tell your keys apart and revoke the right one, up to 80 characters.",
    },
    {
      name: "scopes",
      type: "string[]",
      required: true,
      text: "What it may do. At least one, no repeats. See the table below.",
    },
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/api-keys \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Nightly import", "scopes": ["files:read", "files:write"] }'`,
    },
    {
      label: "JavaScript",
      code: `const { key, id } = await (
  await fetch("${BASE}/api-keys", {
    method: "POST",
    headers: { Authorization: \`Bearer \${accessToken}\`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Nightly import", scopes: ["files:read", "files:write"] }),
  })
).json();`,
    },
  ),
  warn(
    "The key appears **once**, in this answer. Gridline keeps only a fingerprint of it, so it cannot be shown again. Copy it now. Lost a key? Revoke it and make another.",
    "Shown once",
  ),
  p("Use it like any token:"),
  code(
    `curl ${BASE}/files -H "Authorization: Bearer gl_live_ab12cd34_…"`,
    "curl",
  ),

  h2("Scopes"),
  p(
    "A scope is a permission a key carries. A key can do something only if it holds the scope **and** its owner may do it.",
  ),
  table(
    ["Scope", "Who may give it", "What it opens"],
    [
      "`files:read`",
      "Anyone",
      "List and read files, versions, comparisons, reports and previews, download links, comments, the plan and its quota, and the quality rules.",
    ],
    [
      "`files:write`",
      "Anyone",
      "Upload files and new versions, change who can see a file, delete a file, rebuild a report.",
    ],
    [
      "`notifications:read`",
      "Anyone",
      "Read your own notifications and mark them read.",
    ],
    [
      "`mcp`",
      "Anyone",
      "Use the [AI-agent endpoint](/docs/mcp). Which tools the agent gets depends on the other scopes.",
    ],
    ["`billing:read`", "Admins", "The running bill and invoices."],
    ["`rules:write`", "Admins", "Create, edit and delete quality rules."],
    ["`audit:read`", "Admins", "Read the audit log."],
  ),
  p(
    "An employee who tries to give a key an admin-only scope is refused with `403`. You cannot hand out what you do not have.",
  ),

  h2("What a key can never do"),
  p(
    'Keys are **closed by default**. Any endpoint that does not explicitly say "keys welcome" refuses them. That means a leaked key can never:',
  ),
  ul(
    "sign in, change a password or reach your account settings;",
    "invite or remove people, or change a plan;",
    "make, list or revoke API keys (so it cannot create a copy of itself);",
    "manage webhooks, change company details, or read analytics or GraphQL;",
    "write comments.",
  ),

  h2("A key is a name for its owner"),
  p(
    "A key is not a separate user. It acts **as the person who made it, as they are right now**. Their files are its files; their access is its access.",
  ),
  ul(
    "**Demote** the person and the key loses any admin scopes on its next request.",
    "**Disable** the person and every key they made stops working at once.",
    "The audit log records which key did what.",
  ),

  h2("Manage keys"),
  ul(
    "`GET /api-keys`: an admin sees the company's keys; an employee sees only their own. Newest first. The list shows the key's `prefix` and `lastUsedAt`, never the key itself.",
    "`DELETE /api-keys/{id}`: revoke. An admin can revoke any key; an employee only their own (someone else's is a `404`). Revoking twice is fine.",
  ),
  note(
    "Each person can hold up to **25** active keys; beyond that you get `409` until you revoke one. `lastUsedAt` is approximate: it is refreshed at most every five minutes.",
  ),
];

export const ERRORS: Block[] = [
  p(
    "When something goes wrong, every endpoint answers in the same shape, so you only have to write the error handling once.",
  ),
  code(
    `{
  "statusCode": 402,
  "message": "Your free plan allows 10 files per billing period and you have uploaded 10. The quota resets on 2026-11-01. Upgrade with PATCH /subscriptions/me to upload more now.",
  "correlationId": "7d2f6c0e-9e1a-4a35-8c7e-0b9d4b0f5a11",
  "timestamp": "2026-10-02T09:14:03.221Z"
}`,
    "An error",
  ),
  fields(
    {
      name: "statusCode",
      type: "number",
      text: "The HTTP status, repeated in the body.",
    },
    {
      name: "message",
      type: "string | string[]",
      text: "What went wrong, in plain words, and usually how to fix it. A request with several mistakes gets a list.",
    },
    {
      name: "correlationId",
      type: "string",
      text: "An id for this request. It is on every log line the request produced, so quoting it lets support find exactly what happened.",
    },
    { name: "timestamp", type: "ISO date-time", text: "When it happened." },
  ),
  tip(
    "Send your own `X-Correlation-Id` header and Gridline will reuse it, so one id can follow a request from your app through to ours.",
  ),

  h2("Status codes"),
  table(
    ["Code", "Name", "Usually means"],
    [
      "`400`",
      "Bad Request",
      "Something you sent is wrong: a missing field, a value out of range, an unknown field, a file that is not a spreadsheet. `message` lists each problem.",
    ],
    [
      "`401`",
      "Unauthorized",
      "No token, or one that is expired, revoked or invalid. See [Authentication](/docs/authentication).",
    ],
    [
      "`402`",
      "Payment Required",
      "You are over a plan limit that stops work (the file quota on Free or Basic), or the company has not chosen a plan yet.",
    ],
    [
      "`403`",
      "Forbidden",
      "You are known but not allowed: your role is too low, your key lacks a scope, the company is suspended, or it is the read-only demo.",
    ],
    [
      "`404`",
      "Not Found",
      "It does not exist **or you may not see it**. Gridline never tells you which.",
    ],
    [
      "`409`",
      "Conflict",
      "The request is fine but clashes with the current state: a plan limit on people, rules or versions; a report already being built; an address that is already registered.",
    ],
    [
      "`413`",
      "Payload Too Large",
      "A file over 25 MB, or an AI-agent upload over its limit.",
    ],
    [
      "`422`",
      "Unprocessable",
      "Understood but impossible: comparing files that are not versions of each other, or reusing an Idempotency-Key for a different request.",
    ],
    [
      "`429`",
      "Too Many Requests",
      "Your company has used its request budget for this minute. See [Rate limits](/docs/rate-limits).",
    ],
    [
      "`500`",
      "Server Error",
      "Our fault, not yours. The message is generic on purpose; quote the `correlationId`.",
    ],
  ),

  h2("Handling errors well"),
  ul(
    "**Show `message` to a person.** It is written to be read, and it usually says the next step.",
    "**Do not retry a `4xx`** unchanged: it will fail the same way. The exceptions are `409` while something finishes, and `429` after waiting.",
    "**Retry `5xx` and network errors** with a growing delay, and use an [Idempotency-Key](/docs/idempotency) on anything that creates something.",
    "**Log the `correlationId`.** It is the fastest way to a fix.",
  ),
  note(
    "Validation is strict on purpose. A field Gridline does not know is a `400`, not silently ignored, so a typo like `visibilty` is caught immediately instead of quietly doing nothing.",
  ),
];

export const PAGINATION: Block[] = [
  p(
    "Lists can be long, so Gridline returns them a page at a time. There are two styles. Which one an endpoint uses depends on how its list grows, and each endpoint's description says.",
  ),
  table(
    ["", "Cursor", "Page numbers"],
    [
      "Best for",
      "Long lists that keep growing",
      "Short lists you want to jump around in",
    ],
    ["You send", "`cursor` and `limit`", "`page` and `limit`"],
    [
      "Used by",
      "Files, comments, notifications, the audit log",
      "People, invoices, API keys, rules, file versions, webhooks",
    ],
    [
      "Answer includes",
      "`nextCursor` and `hasMore`",
      "`page`, `total` and `totalPages`",
    ],
  ),

  h2("Cursors"),
  p("Ask for a page:"),
  code(
    `curl "${BASE}/files?limit=20" -H "Authorization: Bearer gl_live_YOUR_KEY"`,
    "curl",
  ),
  code(
    `{
  "data": [ { "id": "…", "originalName": "sales-q3.csv" } ],
  "meta": { "nextCursor": "eyJjIjoiMjAyNi0xMC0wMlQwOToxNDowMy4yMjFaIiwiaSI6Ij…", "hasMore": true }
}`,
    "Response",
  ),
  p(
    "To get the next page, send `meta.nextCursor` back as `cursor`. When `hasMore` is `false`, you have everything.",
  ),
  tabs(
    {
      label: "curl",
      code: `curl "${BASE}/files?limit=20&cursor=NEXT_CURSOR" \\
  -H "Authorization: Bearer gl_live_YOUR_KEY"`,
    },
    {
      label: "JavaScript",
      code: `let cursor;
const files = [];
do {
  const url = new URL("${BASE}/files");
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);

  const page = await (await fetch(url, { headers: { Authorization: \`Bearer \${key}\` } })).json();
  files.push(...page.data);
  cursor = page.meta.hasMore ? page.meta.nextCursor : undefined;
} while (cursor);`,
    },
  ),
  note(
    "The cursor is opaque: treat it as a ticket, not something to build or read. It marks a **position**, not a page number, so uploads that arrive while you are paging never cause a repeated or a missing item.",
    "Why a cursor",
  ),

  h2("Page numbers"),
  code(
    `curl "${BASE}/employees?page=2&limit=25" -H "Authorization: Bearer ACCESS_TOKEN"`,
    "curl",
  ),
  code(
    `{
  "data": [ … ],
  "meta": { "page": 2, "limit": 25, "total": 61, "totalPages": 3 }
}`,
    "Response",
  ),

  h2("Limits"),
  ul(
    "`limit` is from 1 to 100. The default is 20.",
    "`page` starts at 1.",
    "Asking for a parameter an endpoint does not have is a `400`.",
  ),
];

export const IDEMPOTENCY: Block[] = [
  p(
    "Networks fail. You send an upload, the connection drops, and you do not know whether it arrived. If you simply send it again, you might upload the file twice and use two slots of your quota. An **idempotency key** makes retrying safe.",
  ),

  h2("How to use it"),
  p(
    "Make up a UUID for each thing you intend to do, and send it in an `Idempotency-Key` header. If you have to retry, send the **same** key.",
  ),
  tabs(
    {
      label: "curl",
      code: `KEY=$(uuidgen)

curl ${BASE}/files \\
  -H "Authorization: Bearer gl_live_YOUR_KEY" \\
  -H "Idempotency-Key: $KEY" \\
  -F "file=@sales-q3.csv"

# Timed out? Run exactly the same command again, with the same $KEY.`,
    },
    {
      label: "JavaScript",
      code: `const idempotencyKey = crypto.randomUUID();

async function upload(form) {
  return fetch("${BASE}/files", {
    method: "POST",
    headers: { Authorization: \`Bearer \${key}\`, "Idempotency-Key": idempotencyKey },
    body: form,
  });
}

// If this throws or times out, calling it again is safe: the same key replays the first answer.`,
    },
  ),

  h2("What happens"),
  table(
    ["You send", "Gridline does"],
    ["A new key", "Runs the request and remembers the answer."],
    [
      "The same key and the same request again",
      "Runs **nothing** and replays the first answer, with the header `Idempotent-Replayed: true`.",
    ],
    [
      "The same key while the first request is still running",
      "Answers `409`. Wait a moment and retry.",
    ],
    [
      "The same key for a **different** request",
      "Answers `422`: a key is for one request.",
    ],
    ["A key that is not a UUID", "Answers `400`."],
  ),
  p(
    '"The same request" means the same endpoint, the same person, the same body and, for an upload, the **same file bytes**.',
  ),
  ul(
    "A request that **failed** is forgotten, so you can fix it and retry with the same key.",
    "Answers are remembered for **24 hours**. After that the same key is a new request.",
    "A request that crashed part-way is released after 10 minutes, so a key is never stuck.",
    "A replayed upload keeps its `X-Gridline-Quota-Warning` header, if it had one.",
  ),

  h2("Where it works"),
  ul(
    "`POST /files`: upload a file.",
    "`POST /files/{id}/versions`: upload a new version.",
    "`PATCH /subscriptions/me`: change plan (so a retry cannot bill the difference twice).",
    "The `upload_file` and `upload_file_version` [AI-agent tools](/docs/mcp), as `idempotencyKey`.",
  ),
  tip(
    "A good rule: give every request that **creates or charges** an idempotency key. Reads do not need one.",
  ),
];

export const RATE_LIMITS: Block[] = [
  p(
    "Gridline limits how fast a company can call the API, and the limit follows the plan you pay for. It is a budget per minute: spend it however you like, and when it runs out you wait.",
  ),

  h2("The budget"),
  table(
    ["Plan", "Requests per minute"],
    ["Free", "30"],
    ["Basic", "120"],
    ["Premium", "600"],
  ),
  p(
    "The budget belongs to the **whole company**, and it is spent by **API keys**: every key of the company draws from the same pool, so two busy scripts share it. A person using the dashboard is counted separately, at 300 requests a minute for each person, so using Gridline never uses up your API budget. A request from a visitor who is not signed in is counted per address, at 120 a minute.",
  ),
  note(
    "Upgrading takes effect on the very next request. A company that was throttled gets a fresh budget the moment its plan changes.",
  ),

  h2("Read your budget"),
  p("Every answer carries three headers:"),
  fields(
    {
      name: "X-RateLimit-Limit",
      text: "The requests per minute you are being counted against: your plan's budget for an API key.",
    },
    {
      name: "X-RateLimit-Remaining",
      text: "How many you have left in this window.",
    },
    { name: "X-RateLimit-Reset", text: "When the window resets." },
  ),

  h2("When you run out"),
  p(
    "Gridline answers `429 Too Many Requests` with a `Retry-After` header and a message that tells you what to do:",
  ),
  code(
    `{
  "statusCode": 429,
  "message": "Your company's free plan allows 30 requests per minute. Try again in 12 seconds. Upgrade to the basic plan (PATCH /subscriptions/me) for 120 requests per minute.",
  "correlationId": "…",
  "timestamp": "…"
}`,
    "Response",
  ),
  ul(
    "Wait the number of seconds in `Retry-After`, then continue.",
    "Spread requests out rather than sending bursts.",
    "Prefer [webhooks](/docs/webhooks) or [live updates](/docs/realtime) to polling: they cost nothing against the budget.",
  ),

  h2("Stricter limits on sensitive actions"),
  p(
    "A few endpoints have a small bucket of their own, per address (or per company when signed in), so they cannot be hammered:",
  ),
  table(
    ["Action", "Per minute"],
    ["Sign in", "10"],
    ["Register, reset a password, accept an invitation", "10"],
    ["Forgot password, resend the activation email", "5"],
    ["Open the demo", "20"],
    ["Choose or change a plan", "10"],
  ),
  p(
    "These buckets do not draw from your main budget. That is on purpose: a company that has used up its requests can **still upgrade** its plan.",
  ),
  note(
    "`GET /health` is never limited. AI-agent calls count like any other request: one per call.",
  ),
];
