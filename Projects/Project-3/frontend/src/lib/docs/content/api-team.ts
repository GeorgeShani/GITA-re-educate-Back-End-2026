import {
  BASE,
  type Block,
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
} from "../blocks";

export const COMMENTS_REF: Block[] = [
  p(
    "Talk about a file where it lives. Anyone who can see a file can read and write its comments, so a question about a column stays next to the column, not in a chat thread nobody can find later.",
  ),

  h2("Write a comment"),
  endpoint(
    "POST",
    "/files/{id}/comments",
    "Signed-in people only. API keys can read comments, not write them.",
  ),
  fields(
    {
      name: "body",
      type: "string",
      required: true,
      text: "The text, 1 to 5,000 characters.",
    },
    {
      name: "parentId",
      type: "uuid",
      text: "To reply: the id of a top-level comment on the same file.",
    },
    {
      name: "mentionedUserIds",
      type: "uuid[]",
      text: "Colleagues to tag, up to 50. They must be active people who can already see the file.",
    },
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/files/FILE_ID/comments \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "body": "Why did the amount column turn into text?", "mentionedUserIds": ["USER_ID"] }'`,
    },
    {
      label: "JavaScript",
      code: `await fetch(\`${BASE}/files/\${fileId}/comments\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${accessToken}\`, "Content-Type": "application/json" },
  body: JSON.stringify({
    body: "Why did the amount column turn into text?",
    mentionedUserIds: [userId],
  }),
});`,
    },
  ),

  h2("Read the discussion"),
  endpoint(
    "GET",
    "/files/{id}/comments",
    "Needs files:read. Cursor pagination.",
  ),
  p(
    "Comments come back oldest first. A reply points at its parent with `parentId`. Threads are one level deep: you can reply to a comment, but not to a reply.",
  ),

  h2("Edit and delete"),
  ul(
    "`PATCH /comments/{id}`: only the author can edit. Edited comments carry `editedAt`.",
    "`DELETE /comments/{id}`: the author **or an admin** can delete.",
  ),
  p(
    "A deleted comment is not removed from the thread. It becomes an empty **tombstone** (`body` is `null`, `deletedAt` is set) so replies keep their place and nobody is left wondering what they answered.",
  ),

  h2("Mentions"),
  ul(
    "A mention sends the person a notification (`comment.mentioned`).",
    "Editing a comment notifies only the people **newly** mentioned.",
    "A mention **never gives anyone access** to a file. Only people who could already see it can be tagged.",
  ),
  note(
    "Comment text is private. It is returned to the people allowed to read the file, and it is never copied into the audit log or into a notification.",
    "Your words stay in the comment",
  ),

  h2("Live"),
  p(
    "With a [live connection](/docs/realtime), new, edited and deleted comments appear for everyone watching the file as they happen, along with who is looking at it and who is typing.",
  ),
];

export const NOTIFICATIONS_REF: Block[] = [
  p(
    "Everyone has an inbox. Gridline writes to it when something happens that you would want to know about, and, for the one thing that is about money, also emails the billing address.",
  ),

  h2("Read your inbox"),
  endpoint(
    "GET",
    "/notifications",
    "Signed-in people, or an API key with notifications:read.",
  ),
  fields(
    {
      name: "unread",
      type: "boolean",
      text: "`true` returns only what you have not read.",
    },
    {
      name: "limit, cursor",
      text: "Newest first. See [Pagination](/docs/pagination).",
    },
  ),
  ul(
    "`GET /notifications/unread-count`: just the number, for a badge.",
    "`POST /notifications/{id}/read`: mark one as read.",
    "`POST /notifications/read-all`: mark everything as read.",
  ),
  p(
    "You only ever see your **own** notifications. Someone else's is a `404`. Read notifications are removed after 90 days; unread ones stay until you read them.",
  ),

  h2("What you can be told"),
  table(
    ["type", "Who gets it", "When"],
    ["`report.ready`", "The uploader", "A report finished."],
    [
      "`report.failed`",
      "The uploader",
      "A report failed for good (not while it is still being retried).",
    ],
    [
      "`rules.failed`",
      "The uploader and every admin",
      "A file failed an **error** rule. It names the rules and the score, never a value.",
    ],
    [
      "`dataset.schema_changed`",
      "The uploader and every admin",
      "A new version removed or retyped a column its predecessor had.",
    ],
    [
      "`file.cleaned`",
      "The person who asked",
      "A cleaned version was made, with how many cells and rows changed.",
    ],
    [
      "`cleaning.failed`",
      "The person who asked",
      "A cleaned version could not be made, with the reason.",
    ],
    [
      "`dataset.changed`",
      "The uploader and every admin",
      "A new version differs from the one before it: how many rows were added, removed and changed. Needs the file's key columns to be saved.",
    ],
    [
      "`file.sensitive_data`",
      "The uploader and every admin",
      "A file the whole company can open holds personal or secret data. It names the columns and the kind, never a value.",
    ],
    ["`file.shared`", "The people added", "A file was shared with you."],
    [
      "`comment.mentioned`",
      "The person tagged",
      "Someone mentioned you in a comment.",
    ],
    [
      "`quota.threshold`",
      "Every admin",
      "The company reached 80% or 100% of its file quota.",
    ],
    [
      "`invoice.finalized`",
      "Every admin",
      "An invoice with something to pay was issued.",
    ],
  ),
  p(
    "Each notification has a `type` and a `payload` that holds ids, counts and names. It never holds a cell value.",
  ),

  h2("Quota alerts"),
  p(
    "When your company reaches **80%** of its files for the billing period, and again at **100%**, every admin gets an inbox entry and the billing address gets an email. Each fires once per period.",
  ),
  table(
    ["At 100% on", "The message says"],
    [
      "Free or Basic",
      "Uploads stop until the period resets, and names the plan that raises the limit.",
    ],
    [
      "Premium",
      "Uploads keep going; each extra file is billed at the overage price.",
    ],
  ),
  tip(
    "You hear about the wall before you hit it, and the message is also the way up.",
  ),

  h2("It is written with the change"),
  p(
    "A notification is saved in the same step as the thing that caused it. If an upload is rolled back, it announces nothing. Live delivery to your open dashboard happens only after that step is complete.",
  ),
];

export const PEOPLE_REF: Block[] = [
  p(
    "A company is people. The first admin invites everyone else. This guide covers inviting, what it costs, and what happens when someone leaves.",
  ),

  h2("Invite someone"),
  endpoint("POST", "/employees", "Admins only. Needs a session."),
  fields(
    {
      name: "email",
      type: "string",
      required: true,
      text: "Where the invitation goes. The person signs in with this address.",
    },
    {
      name: "fullName",
      type: "string",
      required: true,
      text: "Their name, as colleagues will see it.",
    },
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/employees \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "tamar@acme.com", "fullName": "Tamar Beridze" }'`,
    },
    {
      label: "JavaScript",
      code: `await fetch("${BASE}/employees", {
  method: "POST",
  headers: { Authorization: \`Bearer \${accessToken}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ email: "tamar@acme.com", fullName: "Tamar Beridze" }),
});`,
    },
  ),
  p(
    "They get an email with a link. Following it, they choose a password or join with Google, and they are in.",
  ),
  h3("An invitation holds a seat, but costs nothing yet"),
  p(
    "Your plan limits how many people you can have, and an invited person counts toward that limit straight away, so two admins cannot invite more people than the plan allows. You are **not billed** for them until they accept.",
  ),
  table(
    ["Plan", "Employees"],
    ["Free", "None: just the admin"],
    ["Basic", "Up to 10"],
    ["Premium", "No limit"],
  ),
  p(
    "Inviting past the limit answers `409` and says so. Inviting an address that already has a password account with Gridline is refused up front, because one login email is one account.",
  ),

  h2("See your people"),
  endpoint("GET", "/employees", "Admins only."),
  p(
    "Lists everyone with their `role` and `status` (`invited`, `active` or `disabled`). Filter with `?status=` and `?role=`, and page with `?page=` and `?limit=`.",
  ),
  p(
    "Every signed-in person, admin or not, can use `GET /companies/me/members` to get a names-only list of colleagues: handy for picking who to share a file with, and nothing more.",
  ),

  h2("Invitations that did not arrive"),
  endpoint("POST", "/employees/{id}/resend-invite", "Admins only."),
  p("A new link is sent, and the old one stops working."),

  h2("Remove someone"),
  endpoint("DELETE", "/employees/{id}", "Admins only."),
  p("Removing a person is a **soft disable**. At once, in one step:"),
  ul(
    "their access stops, and they cannot sign in;",
    "their seat is freed, and billing stops counting them;",
    "their sessions, sign-in methods and file shares are revoked;",
    "their **API keys stop working**, and any open live connection is closed.",
  ),
  p(
    "What they **uploaded stays with the company**, and the audit trail keeps showing what they did.",
  ),

  h2("Bring someone back"),
  endpoint("POST", "/employees/{id}/reactivate", "Admins only."),
  p(
    "Reactivating sends a **fresh invitation**: their old sign-in methods were deleted when they were removed, so they choose a password (or Google) again. They take a seat again, and the plan limit is checked again.",
  ),
  note(
    "Seats are counted under a lock, so two admins who invite at the same moment cannot both take the last seat.",
  ),
];
