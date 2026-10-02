import {
  BASE,
  type Block,
  code,
  endpoint,
  fields,
  h2,
  h3,
  note,
  ol,
  p,
  table,
  tabs,
  tip,
  ul,
  warn,
} from "../blocks";

export const WEBHOOKS: Block[] = [
  p(
    'A webhook is Gridline calling **you**. Instead of asking "is the report ready yet?" over and over, you give Gridline an address and it sends you a message the moment something happens. Webhooks are signed, so you can be sure a message really came from us.',
  ),

  h2("In the dashboard"),
  p(
    "Admins can manage endpoints without code under **Developers → Webhooks**: add an endpoint (its signing secret is shown once), **Send a test**, pause or resume it, replace its secret, remove it, and read every delivery with its status, response code and attempts. A failed delivery has a **Send again** button.",
  ),

  h2("Set one up"),
  endpoint(
    "POST",
    "/outgoing-webhooks",
    "Admins only, with a session. API keys cannot manage webhooks.",
  ),
  fields(
    {
      name: "name",
      type: "string",
      required: true,
      text: "A label for you, up to 100 characters.",
    },
    {
      name: "url",
      type: "string",
      required: true,
      text: "Where to send events. Use HTTPS. Addresses that point to private networks are refused.",
    },
    {
      name: "events",
      type: "string[]",
      required: true,
      text: "Which events you want. See the list below.",
    },
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/outgoing-webhooks \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Slack bridge",
    "url": "https://example.com/hooks/gridline",
    "events": ["report.ready", "rules.failed"]
  }'`,
    },
    {
      label: "JavaScript",
      code: `const endpoint = await (
  await fetch("${BASE}/outgoing-webhooks", {
    method: "POST",
    headers: { Authorization: \`Bearer \${accessToken}\`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Slack bridge",
      url: "https://example.com/hooks/gridline",
      events: ["report.ready", "rules.failed"],
    }),
  })
).json();
console.log(endpoint.secret); // whsec_… shown once`,
    },
  ),
  warn(
    "The answer includes a `secret` that starts with `whsec_`. It is shown **once**. Save it in your receiver now: it is how you check that a message is genuine. If you lose it, rotate it.",
    "Copy the secret",
  ),
  p(
    "How many endpoints you can have depends on your plan: **Free 1, Basic 5, Premium no limit**.",
  ),

  h2("Events"),
  table(
    ["Event", "Sent when", "`data` contains"],
    [
      "`file.uploaded`",
      "A file or a new version was saved.",
      "`fileId`, `datasetId`, `version`",
    ],
    [
      "`report.ready`",
      "A report finished successfully.",
      "`fileId`, `reportStatus`",
    ],
    [
      "`report.failed`",
      "A report failed for good.",
      "`fileId`, `reportStatus`",
    ],
    [
      "`rules.failed`",
      "A file failed an **error** rule.",
      "`fileId`, `failedRuleCount`, `qualityScore`",
    ],
    [
      "`quota.threshold`",
      "The company reached 80% or 100% of its file quota.",
      "`threshold`, `plan`, `periodKey`, `filesUsed`, `filesLimit`",
    ],
    [
      "`invoice.finalized`",
      "An invoice was issued.",
      "`invoiceId`, `totalCents`, `periodStart`, `periodEnd`",
    ],
  ),
  p(
    "There is also `ping`, which you trigger yourself to test an endpoint (`POST /outgoing-webhooks/{id}/ping`). Events carry **ids and numbers, never cell values**. When you need details, fetch them with an API key.",
  ),

  h2("What you receive"),
  p("A `POST` with a JSON body:"),
  code(
    `{
  "id": "6f1e0c52-6a5e-4a52-8a7d-3b6b0b8d2f10",
  "type": "report.ready",
  "createdAt": "2026-10-02T09:14:07.014Z",
  "companyId": "…",
  "schemaVersion": 1,
  "data": { "fileId": "5b0c1f1e-…", "reportStatus": "ready" }
}`,
    "Body",
  ),
  p("and these headers:"),
  fields(
    {
      name: "webhook-id",
      text: "The event's id. It is the same on every retry of the same event, so you can use it to ignore duplicates.",
    },
    {
      name: "webhook-timestamp",
      text: "When it was sent, in seconds since 1970.",
    },
    {
      name: "webhook-signature",
      text: "`v1=` followed by the signature (see below).",
    },
    { name: "user-agent", text: "`Gridline-Webhooks/1.0`." },
  ),

  h2("Check the signature"),
  p(
    "Anyone can send a request to your address, so verify every one. The signature is an HMAC-SHA256 of the timestamp, a dot, and the **exact raw body**, keyed with your `whsec_…` secret.",
  ),
  code(
    `import { createHmac, timingSafeEqual } from "node:crypto";

export function isGenuine(secret, headers, rawBody) {
  const timestamp = headers["webhook-timestamp"];
  const received = headers["webhook-signature"];

  const expected =
    "v1=" + createHmac("sha256", secret).update(\`\${timestamp}.\${rawBody}\`).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(received ?? "");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  // Reject old messages, so a captured one cannot be replayed later.
  return Math.abs(Date.now() / 1000 - Number(timestamp)) < 300;
}`,
    "Node.js",
  ),
  warn(
    "Sign the **raw** request body, byte for byte, before any JSON parsing. Parsing and re-serialising changes the bytes and the check will fail.",
  ),

  h2("Replying"),
  p(
    "Answer with any `2xx` status as soon as you have **received** the event, and do the real work afterwards. Gridline treats anything else (or no answer) as a failure.",
  ),

  h2("Retries"),
  ul(
    "A failed delivery is retried up to **5 times** in all, with a growing delay between attempts.",
    "Delivery is **at least once**: an event can arrive twice. Use `webhook-id` to skip ones you have already handled.",
    'An answer of **`410 Gone`** means "stop sending these": the endpoint is disabled at once.',
    'After **20 failed deliveries in a row**, the endpoint is disabled automatically. Fix the receiver, then turn it back on with `PATCH /outgoing-webhooks/{id}` and `{ "active": true }`.',
    "Events are sent **after** the change is saved. If an upload is rolled back, no event leaves.",
  ),
  note(
    "Every attempt looks up your address again, refuses private and internal networks, does not follow redirects, and sends to the exact address it checked. A receiver cannot be turned into a way to reach into our network.",
    "Safe by construction",
  ),

  h2("Manage endpoints"),
  ul(
    "`GET /outgoing-webhooks`: list your endpoints.",
    "`PATCH /outgoing-webhooks/{id}`: change the `name`, `url`, `events` or `active`.",
    "`DELETE /outgoing-webhooks/{id}`: remove one.",
    "`POST /outgoing-webhooks/{id}/rotate-secret`: make a new secret (shown once). The old one stops signing at once, so deliveries in flight use the new one. Update your receiver first, or accept a few failed checks.",
    "`GET /outgoing-webhooks/{id}/deliveries`: what was sent, with `status`, `attempts`, the answer's status and the last error. Kept for 30 days.",
    "`POST /outgoing-webhooks/deliveries/{deliveryId}/redeliver`: send one again.",
  ),
  tip(
    "Building something that reacts to uploads? Subscribe to `report.ready`, then fetch `GET /files/{fileId}/report` with an API key.",
  ),
];

export const REALTIME: Block[] = [
  p(
    "Open one connection and Gridline tells you what is happening as it happens: a report moving from `queued` to `ready`, a quota being spent, a notification arriving, a colleague typing a comment. Nothing to poll.",
  ),

  h2("Connect"),
  p(
    "Gridline uses [Socket.IO](https://socket.io). Connect to the same address as the app and send your access token in the handshake:",
  ),
  tabs({
    label: "JavaScript",
    code: `import { io } from "socket.io-client";

const socket = io("https://YOUR-DOMAIN", {
  auth: { token: accessToken },   // the access token from signing in
});

socket.on("file.status", ({ fileId, status, qualityScore }) => {
  console.log(fileId, status, qualityScore);
});`,
  }),
  ul(
    "Use an **access token** (a session). API keys are for programs calling the REST API, and are refused here.",
    'If the token is bad, the person is disabled, or their company is not active, the connection is refused with one generic "Unauthorized".',
    "The server decides what you are allowed to hear. You send it nothing except the handshake and the few commands listed below.",
  ),

  h2("What you hear"),
  table(
    ["Event", "Payload", "Who hears it"],
    [
      "`file.status`",
      "`fileId`, `status`, `error`, `qualityScore`",
      "Everyone who may see that file.",
    ],
    [
      "`quota.updated`",
      "`plan`, `periodKey`, `filesUsed`, `filesLimit`",
      "The company.",
    ],
    [
      "`notification.created`",
      "The new notification, as `GET /notifications` returns it",
      "Only its owner.",
    ],
    [
      "`audit.appended`",
      "`id`, `action`, `actorUserId`, `targetType`, `targetId`, `createdAt`",
      "Admins.",
    ],
    [
      "`comment.created`, `comment.updated`, `comment.deleted`",
      "The comment",
      "People watching that file.",
    ],
    [
      "`comment.typing`",
      "`fileId`, `userId`, `isTyping`",
      "People watching that file.",
    ],
    ["`presence.changed`", "`fileId`, `userIds`", "People watching that file."],
    [
      "`session.expiring`, `session.expired`",
      "`expiresAt` / `expiredAt`",
      "You.",
    ],
  ),
  h3("Only after it is true"),
  p(
    "Events are sent **after** the change is saved, never during. If an upload is rolled back, nobody is told it happened. Who hears an event is worked out at the moment it is sent, from the file's current access: a restricted file's events reach only the people who may see it.",
  ),

  h2("Watch a file"),
  p(
    "To follow one file's comments, who is looking, and who is typing, tell the server you are watching it:",
  ),
  code(
    `socket.emit("file.watch", { fileId }, (result) => {
  // { ok: true }  or  { ok: false, error: "unauthorized" | "rate_limited" | "too_many_files" }
});

socket.emit("comment.typing", { fileId, isTyping: true });
socket.emit("file.unwatch", { fileId }, () => {});`,
    "JavaScript",
  ),
  ul(
    "You can watch up to **20 files** at once per connection, and send up to 20 watch commands every 10 seconds.",
    "Typing indicators are limited to 5 a second.",
    "If a file's access changes and you may no longer see it, you are removed from its room immediately.",
  ),

  h2("Stay connected"),
  p(
    "A connection lives as long as the access token it started with. About a minute before the end you receive `session.expiring`; at the end, `session.expired`, and the server disconnects. To carry on, get a new token and tell the server:",
  ),
  code(
    `socket.on("session.expiring", async () => {
  const fresh = await refreshAccessToken();
  socket.emit("auth.refresh", { token: fresh }, (result) => {
    // { ok: true, expiresAt } or { ok: false, error: "unauthorized" }
  });
});`,
    "JavaScript",
  ),
  note(
    "The new token must be for the **same person**, and must be sent before the old one runs out. Your rooms are rebuilt from your role as it is now, so a demotion takes effect without reconnecting.",
  ),
  note(
    "If something is missed (you were offline), the REST API is always the source of truth. Fetch the current state when you reconnect.",
  ),
];

export const GRAPHQL: Block[] = [
  p(
    "GraphQL lets one request ask for exactly the files, reports, comments and usage numbers a screen needs, with nothing extra and no second trip. It is **read-only**: there is no way to change anything through it.",
  ),

  h2("Send a query"),
  endpoint(
    "POST",
    "/graphql",
    "People signed in with a session. API keys cannot use it.",
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE.replace("/api", "")}/graphql \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "query": "{ files(first: 5) { nodes { id originalName version report { status qualityScore } } pageInfo { hasMore nextCursor } } }" }'`,
    },
    {
      label: "JavaScript",
      code: `const response = await fetch("https://YOUR-DOMAIN/graphql", {
  method: "POST",
  headers: { Authorization: \`Bearer \${accessToken}\`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query: \`{
      files(first: 5) {
        nodes { id originalName version report { status qualityScore } }
        pageInfo { hasMore nextCursor }
      }
    }\`,
  }),
});
const { data, errors } = await response.json();`,
    },
  ),

  h2("What you can ask for"),
  table(
    ["Query", "Returns"],
    [
      "`files(first, after, sort, filter)`",
      "The files you may see, with the same filters, cursor and visibility rules as `GET /files`. Up to 50 per page.",
    ],
    ["`file(id)`", "One file, or `null` if you may not see it."],
    [
      "`usage(from, to)`",
      "The same analytics as `GET /analytics/usage`. Admins only.",
    ],
  ),
  p(
    "A `File` has its `report` (status, metrics, rule results, score, summary), its `uploader`, its `versions` (up to 50), a `commentCount` and a `comments` thread. `grants` (who a restricted file is shared with) is filled in only for an admin or the uploader.",
  ),
  code(
    `{
  files(first: 20, filter: { visibility: restricted }, sort: NEWEST) {
    nodes {
      id
      originalName
      uploader { fullName }
      report { status qualityScore ruleResults { name status severity } }
      versions { version createdAt }
    }
    pageInfo { hasMore nextCursor }
  }
}`,
    "A dashboard in one request",
  ),

  h2("The same rules as REST"),
  ul(
    "A restricted file you may not see is `null`, exactly as REST answers 404.",
    "Numbers are computed by the same code as the REST endpoints, so the two always agree.",
    "Related data (uploaders, reports, versions) is fetched once per request, in batches, and always limited to your company.",
  ),

  h2("Limits"),
  table(
    ["Limit", "Value"],
    ["Query depth", "6 levels"],
    ["Query cost", "1,000 (lists cost more, and nested lists multiply)"],
    ["`files(first: …)`", "At most 50"],
  ),
  p(
    "Limits are checked **before** anything runs, and the error says which was exceeded and by how much. Asking for the same expensive field six times under different names does not get around them: it is priced as six.",
  ),
  note(
    "Errors in GraphQL come back with HTTP status `200` and an `errors` list, as GraphQL clients expect. The schema is explorable outside production by introspection.",
  ),
];

export const MCP: Block[] = [
  p(
    "Gridline speaks the Model Context Protocol (MCP), so an AI agent such as Claude Code, Claude Desktop or Cursor can work with your company's data: list files, read quality reports, compare versions and upload new data. It uses the same services as the dashboard and the REST API, so access, quotas and the audit log work exactly as they do there.",
  ),

  h2("Connect an agent"),
  ol(
    "Create an API key (**Developers → API keys**) with the `mcp` scope, plus the scopes for what the agent may do.",
    "Give the key to your agent's MCP client.",
  ),
  p("With Claude Code:"),
  code(
    `claude mcp add --transport http gridline https://YOUR-DOMAIN/api/mcp \\
  --header "Authorization: Bearer gl_live_…"`,
    "shell",
  ),
  p(
    "Any client that supports Streamable HTTP and a bearer header works the same way. Behind the proxy the address is `/api/mcp`; reached directly it is `/mcp`.",
  ),

  h2("What the agent can see"),
  p(
    "The agent is offered only the tools its key may use. A key acts as the person who created it, as they are right now: demote or disable them and the agent changes with them on its next call. A key is never more powerful than its owner or its scopes.",
  ),
  table(
    ["Scope", "Tools it adds"],
    ["`mcp`", "Lets the key use the endpoint at all."],
    [
      "`files:read`",
      "`list_files`, `get_file`, `list_file_versions`, `get_quality_report`, `preview_file`, `compare_versions`, `list_comments`, `get_plan_and_quota`, `list_quality_rules`",
    ],
    [
      "`files:write`",
      "`upload_file`, `upload_file_version`, `rebuild_quality_report`",
    ],
    [
      "`rules:write` (admins)",
      "`create_quality_rule`, `update_quality_rule`, `delete_quality_rule`",
    ],
    [
      "`billing:read` (admins)",
      "`get_current_bill`, `list_invoices`, `get_invoice`",
    ],
    ["`audit:read` (admins)", "`list_audit_log`, `get_audit_entry`"],
    [
      "`notifications:read`",
      "`list_notifications`, `get_unread_count`, `mark_notifications_read`",
    ],
  ),

  h2("Uploading through an agent"),
  p(
    "An agent sends a file as plain `text` (for a CSV) or as `base64` (for any spreadsheet), up to **8 MB**. Larger files go through `POST /files`. What the file is gets decided from its content, never its name, exactly as for any upload. It counts against your plan's file quota, and a refusal says why.",
  ),
  p(
    "If a call times out, the agent repeats it with the same `idempotencyKey` (any UUID): it cannot upload twice. See [Idempotent requests](/docs/idempotency).",
  ),

  h2("The record"),
  p(
    'Everything an agent changes is written to the [audit log](/docs/audit-log) with `via: "mcp"` and the key that acted, so you can see what an agent did and when. The read-only [demo company](/docs/demo) offers agents no write tools at all.',
  ),

  h2("What an agent cannot do"),
  p(
    "Comments, people, plans and payment, API keys, webhooks, deleting files and changing who can see one stay with a signed-in person. Revoke the key and the agent is cut off immediately.",
  ),
  tip(
    "Start an agent with `files:read` and `mcp` only. Add `files:write` once you trust what it does.",
  ),
];
