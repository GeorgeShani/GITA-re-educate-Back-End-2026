import { type Block, h2, h3, note, p, steps, table, tip, ul } from "../blocks";

export const COMMENTS: Block[] = [
  p(
    "Talk about a file where it lives. Anyone who can see a file can read and write its comments, so a question about a column stays next to the column, not in a chat thread nobody can find later.",
  ),

  h2("Write a comment"),
  steps(
    {
      title: "Open the file",
      text: "Choose it in **Files**, then choose the **Comments** tab.",
    },
    {
      title: "Write",
      text: "Type in the box under **Add a comment**. A comment can be up to 5,000 characters.",
    },
    {
      title: "Mention a colleague (optional)",
      text: "Choose **Mention colleagues** under the box and tick the people you want to tell. They get a notification. Only people who can already see the file are offered.",
    },
    {
      title: "Choose Comment",
      text: "It appears at the bottom of the conversation, with your name and the time.",
    },
  ),

  h2("Reply"),
  p(
    "Choose **Reply** under a comment, write your answer and choose **Reply** again. Replies sit indented under the comment they answer. Threads are one level deep: you can reply to a comment, but not to a reply.",
  ),
  p("Comments are listed oldest first, so a conversation reads top to bottom."),

  h2("Edit and delete"),
  ul(
    "**Edit** is for the author only. An edited comment says **(edited)** beside the time.",
    "**Delete** is for the author **or an admin**.",
  ),
  p(
    "A deleted comment is not removed from the thread. It is replaced by a short line saying it was deleted, so replies keep their place and nobody is left wondering what they answered.",
  ),

  h2("Mentions"),
  ul(
    "A mention sends the person a notification.",
    "Editing a comment notifies only the people **newly** mentioned.",
    "A mention **never gives anyone access** to a file. Only people who could already see it can be tagged.",
  ),
  note(
    "Comment text is private. It is shown to the people allowed to read the file, and it is never copied into the audit log or into a notification.",
    "Your words stay in the comment",
  ),

  h2("In the demo company"),
  p(
    "The [demo company](/docs/demo) is read-only, so you can read its comments but not write them.",
  ),

  h2("From code"),
  p(
    "Reading, writing, editing and deleting comments are available over HTTP, and new comments can arrive live: see [Team and collaboration API](/docs/team-api) and [Live updates](/docs/realtime).",
  ),
];

export const NOTIFICATIONS: Block[] = [
  p(
    "Everyone has an inbox. Gridline writes to it when something happens that you would want to know about, and, for the one thing that is about money, also emails the billing address.",
  ),

  h2("Read your inbox"),
  p(
    "The bell in the top bar shows how many notifications you have not read yet. Choose it, or choose **Notifications** in the sidebar, to read them.",
  ),
  steps(
    {
      title: "Open Notifications",
      text: "Newest first. Unread ones stand out.",
    },
    {
      title: "Read one",
      text: "Each says what happened and links to the file or page it is about.",
    },
    {
      title: "Mark as read",
      text: "Mark one as read, or mark them all at once. The bell's number goes down.",
    },
  ),
  p(
    "You only ever see your **own** notifications. Read notifications are removed after 90 days; unread ones stay until you read them.",
  ),

  h2("What you can be told"),
  table(
    ["Notification", "Who gets it", "When"],
    ["Report ready", "The uploader", "A report finished."],
    [
      "Report failed",
      "The uploader",
      "A report failed for good (not while it is still being retried).",
    ],
    [
      "Rules failed",
      "The uploader and every admin",
      "A file failed an **error** rule. It names the rules and the score, never a value.",
    ],
    [
      "Columns changed",
      "The uploader and every admin",
      "A new version removed or retyped a column its predecessor had.",
    ],
    ["File shared", "The people added", "A file was shared with you."],
    [
      "You were mentioned",
      "The person tagged",
      "Someone mentioned you in a comment.",
    ],
    [
      "Quota threshold",
      "Every admin",
      "The company reached 80% or 100% of its file allowance.",
    ],
    [
      "Invoice issued",
      "Every admin",
      "An invoice with something to pay was issued.",
    ],
  ),
  p(
    "A notification holds names, counts and links. It never holds a cell value from your files.",
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
    "A notification is saved in the same step as the thing that caused it. If an upload is rolled back, it announces nothing. The bell updates only after that step is complete.",
  ),

  h2("From code"),
  p(
    "Your inbox is available over HTTP: see [Team and collaboration API](/docs/team-api#notifications).",
  ),
];

export const PEOPLE: Block[] = [
  p(
    "A company is people. The first admin invites everyone else. This guide covers inviting, what it costs, and what happens when someone leaves. Only admins see **People** in the sidebar.",
  ),

  h2("Invite someone"),
  steps(
    {
      title: "Open People",
      text: "Choose **People** in the sidebar. Everyone in your company is listed with their role and whether they have joined yet.",
    },
    {
      title: "Choose Invite",
      text: "Enter their **email** (where the invitation goes, and the address they will sign in with) and their **full name**, as colleagues will see it.",
    },
    {
      title: "Send",
      text: "They get an email with a link. Following it, they choose a password or join with Google, and they are in.",
    },
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
    "Inviting past the limit is refused and says so. Inviting an address that already has a password account with Gridline is refused up front, because one login email is one account.",
  ),

  h2("Invitations that did not arrive"),
  p(
    "Next to a person who has not joined yet, choose **Resend invitation**. A new link is sent and the old one stops working.",
  ),

  h2("Remove someone"),
  p(
    "Choose **Remove** next to their name and confirm. Removing a person is a **soft disable**. At once, in one step:",
  ),
  ul(
    "their access stops, and they cannot sign in;",
    "their seat is freed, and billing stops counting them;",
    "their sessions, sign-in methods and file shares are revoked;",
    "their **API keys stop working**, and any open live connection is closed.",
  ),
  p(
    "What they **uploaded stays with the company**, and the audit log keeps showing what they did.",
  ),

  h2("Bring someone back"),
  p(
    "Choose **Reactivate** next to a removed person. That sends a **fresh invitation**: their old sign-in methods were deleted when they were removed, so they choose a password (or Google) again. They take a seat again, and the plan limit is checked again.",
  ),
  note(
    "Seats are counted under a lock, so two admins who invite at the same moment cannot both take the last seat.",
  ),

  h2("Everyone else"),
  p(
    "Employees do not manage people, but they can pick colleagues by name when they share a file or mention someone in a comment. They see names only, nothing else about them.",
  ),

  h2("From code"),
  p(
    "Inviting, listing, removing and reactivating people are available over HTTP: see [Team and collaboration API](/docs/team-api#people).",
  ),
];
