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
  ul,
} from "../blocks";

export const AUDIT_LOG_REF: Block[] = [
  p(
    'Every time something changes in your company, Gridline writes down who did it, what they did, to what, and when. Nobody can edit or remove those lines, not even an admin, not even us through the application. When you need to answer "who changed that?", this is the place.',
  ),

  h2("Read the log"),
  endpoint(
    "GET",
    "/audit",
    "Admins only. An API key needs the audit:read scope.",
  ),
  fields(
    {
      name: "action",
      type: "string",
      text: "Only one kind of event, such as `file.deleted`.",
    },
    { name: "actorUserId", type: "uuid", text: "Only what one person did." },
    {
      name: "targetType",
      type: "string",
      text: "The kind of thing acted on, such as `file` or `employee`.",
    },
    {
      name: "from / to",
      type: "ISO date-time",
      text: "A time window: `from` inclusive, `to` exclusive.",
    },
    {
      name: "limit, cursor",
      text: "Newest first. See [Pagination](/docs/pagination).",
    },
  ),
  tabs(
    {
      label: "curl",
      code: `curl "${BASE}/audit?action=file.deleted&limit=10" \\
  -H "Authorization: Bearer ACCESS_TOKEN"`,
    },
    {
      label: "JavaScript",
      code: `const log = await (
  await fetch("${BASE}/audit?action=file.deleted&limit=10", {
    headers: { Authorization: \`Bearer \${accessToken}\` },
  })
).json();`,
    },
  ),
  code(
    `{
  "id": "…",
  "action": "file.deleted",
  "actorUserId": "…",
  "targetType": "file",
  "targetId": "…",
  "ip": "203.0.113.7",
  "correlationId": "7d2f…",
  "createdAt": "2026-10-02T09:30:11.482Z"
}`,
    "One entry",
  ),
  p(
    "The list leaves out each entry's `metadata`. Read a single entry with `GET /audit/{id}` to see the details specific to its action, such as the plan changed to or a file's name.",
  ),
  fields(
    {
      name: "actorUserId",
      type: "uuid | null",
      text: "Who did it. `null` for the system (the nightly billing run) or for a person who has since been removed.",
    },
    {
      name: "correlationId",
      type: "string",
      text: "Ties together every entry one request wrote, and matches that request's logs. Quote it to support.",
    },
    {
      name: "ip",
      type: "string | null",
      text: "The caller's address, when the change came over the web.",
    },
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
    "The table is **append-only at the database level**: the database itself refuses to update or delete a row.",
    "Entries made by a program say so. An API key's entries carry its id in `metadata.apiKeyId`, and an AI agent's carry `via: \"mcp\"`, so you can always tell a person from a script.",
  ),
  p(
    "New entries also arrive as they happen on a [live connection](/docs/realtime) as `audit.appended`.",
  ),
];

export const ACCOUNT_REF: Block[] = [
  p(
    "Your account is you: your name, how you sign in, and the company details your admin keeps up to date.",
  ),

  h2("Who am I?"),
  endpoint("GET", "/auth/me", "Needs a session."),
  p("Returns the signed-in person and their company in one call:"),
  code(
    `{
  "user": { "id": "…", "email": "nino@acme.com", "fullName": "Nino Beridze", "role": "admin", "status": "active", "activatedAt": "…" },
  "company": { "id": "…", "name": "Acme Logistics", "billingEmail": "billing@acme.com", "country": "GE", "industry": "logistics", "status": "active", "isDemo": false }
}`,
    "Response",
  ),
  p(
    "Your role and status are read from the database on **every** request, not copied from your token. So when an admin changes your role or removes you, it takes effect on your very next click.",
  ),

  h2("Your name"),
  endpoint("PATCH", "/users/me"),
  code(
    `curl -X PATCH ${BASE}/users/me \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "fullName": "Nino B." }'`,
    "curl",
  ),

  h2("Your password"),
  endpoint("PATCH", "/auth/password", "Needs a session."),
  fields(
    {
      name: "currentPassword",
      type: "string",
      required: true,
      text: "To prove it is you.",
    },
    {
      name: "newPassword",
      type: "string",
      required: true,
      text: "8 to 128 characters, and different from the current one.",
    },
  ),
  p(
    "Changing your password signs your sessions out, so anyone who had got hold of an old one is out too.",
  ),
  h3("Forgot it?"),
  ul(
    "`POST /auth/password/forgot` with your `email` sends a reset link. The answer is **always the same**, whether or not the address has an account, so nobody can use it to find out who is registered.",
    "`POST /auth/password/reset` with the link's `token` and a `newPassword` sets the new one. A link works once, and only the newest link works.",
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
  ul(
    "`GET /auth/identities`: how you can sign in today (password, Google).",
    "`POST /auth/identities/google/link`: start connecting a Google account to yourself.",
    "`DELETE /auth/identities/{id}`: disconnect one. You cannot remove your **last** way to sign in; the answer is `409`.",
  ),

  h2("Company details"),
  endpoint("PATCH", "/companies/me", "Admins only."),
  fields(
    { name: "name", type: "string", text: "The company's name." },
    {
      name: "country",
      type: "string",
      text: "Two-letter ISO code, such as `GE`.",
    },
    {
      name: "industry",
      type: "string",
      text: "One of the industries offered at sign-up.",
    },
    {
      name: "billingEmail",
      type: "string",
      text: "Where invoices and account notices go, including quota emails.",
    },
  ),
  p(
    "The company is always the one you belong to. You never send a company id, and sending one is refused.",
  ),

  h2("Activation"),
  p(
    "A new company is inactive until its admin follows the emailed link (`GET /auth/activate?token=…`). If the email did not arrive, `POST /auth/resend-activation` with the `email` sends another. It answers the same whether or not the address is registered.",
  ),
];
