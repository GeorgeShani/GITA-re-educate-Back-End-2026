import {
  BASE,
  type Block,
  cards,
  code,
  h2,
  note,
  ol,
  p,
  steps,
  table,
  tabs,
  tip,
  ul,
  warn,
} from "../blocks";

export const API_QUICKSTART: Block[] = [
  p(
    "This is the quickstart for developers. You will create a company, get an API key, upload a spreadsheet and read the quality report Gridline writes for it, all from code. It takes about ten minutes. If you would rather click than type, the [dashboard quickstart](/docs/quickstart) does the same in five.",
  ),
  note(
    `Every example sends to \`${BASE}\`. Replace \`YOUR-DOMAIN\` with the address you use to open Gridline. The API is reached at \`/api\` on that same domain. (Running the API on your own machine without the proxy, it listens on \`http://localhost:4000\` and has **no** \`/api\` prefix: \`/health\`, \`/files\`, and so on.)`,
  ),

  h2("1. Create your company"),
  p(
    "Registering creates the company and its first person, the admin. Nothing can sign in until the address is confirmed, so Gridline emails an activation link first.",
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/auth/register-company \\
  -H "Content-Type: application/json" \\
  -d '{
    "companyName": "Acme Logistics",
    "email": "nino@acme.com",
    "password": "a long passphrase",
    "country": "GE",
    "industry": "logistics"
  }'`,
    },
    {
      label: "JavaScript",
      code: `const response = await fetch("${BASE}/auth/register-company", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    companyName: "Acme Logistics",
    email: "nino@acme.com",
    password: "a long passphrase",
    country: "GE",
    industry: "logistics",
  }),
});
console.log(await response.json());`,
    },
  ),
  p(
    "Open the link in the email to activate. Passwords are at least 8 characters. Country is a two-letter code such as `GE` or `US`. Industry is one of `finance`, `e-commerce`, `healthcare`, `education`, `logistics`, `manufacturing`, `media`, `real-estate`, `technology` or `other`.",
  ),

  h2("2. Sign in and choose a plan"),
  p(
    "Signing in returns a short-lived access token (15 minutes). Choosing the Free plan needs no card and takes effect at once.",
  ),
  tabs(
    {
      label: "curl",
      code: `# Sign in
curl ${BASE}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "nino@acme.com", "password": "a long passphrase" }'

# Choose the Free plan, using the accessToken from the answer above
curl ${BASE}/subscriptions/me \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "plan": "free" }'`,
    },
    {
      label: "JavaScript",
      code: `const login = await fetch("${BASE}/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "nino@acme.com", password: "a long passphrase" }),
});
const { accessToken } = await login.json();

await fetch("${BASE}/subscriptions/me", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${accessToken}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ plan: "free" }),
});`,
    },
  ),

  h2("3. Create an API key"),
  p(
    "A program should use an API key, not your password. A key is a name for you: it can do what you can, narrowed to the scopes you pick. This one may read and write files.",
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/api-keys \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Quickstart", "scopes": ["files:read", "files:write"] }'`,
    },
    {
      label: "JavaScript",
      code: `const created = await fetch("${BASE}/api-keys", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${accessToken}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "Quickstart", scopes: ["files:read", "files:write"] }),
});
const { key } = await created.json(); // gl_live_…`,
    },
  ),
  warn(
    "The key is shown once, in this answer, and only a fingerprint is stored. Copy it somewhere safe now. If you lose it, revoke it and make a new one.",
    "Copy it now",
  ),

  h2("4. Upload a spreadsheet"),
  p(
    "Send the file as `multipart/form-data` in a field called `file`. CSV, XLS and XLSX are accepted, up to 25 MB.",
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/files \\
  -H "Authorization: Bearer gl_live_YOUR_KEY" \\
  -F "file=@sales-q3.csv"`,
    },
    {
      label: "JavaScript",
      code: `import { readFile } from "node:fs/promises";

const form = new FormData();
form.append("file", new Blob([await readFile("sales-q3.csv")]), "sales-q3.csv");

const upload = await fetch("${BASE}/files", {
  method: "POST",
  headers: { Authorization: \`Bearer \${key}\` },
  body: form,
});
const file = await upload.json();`,
    },
  ),
  p("Gridline answers `201` with the file:"),
  code(
    `{
  "id": "5b0c1f1e-6a63-4c0e-9d6f-0d9a3f2b7a11",
  "originalName": "sales-q3.csv",
  "mimeType": "text/csv",
  "sizeBytes": 48213,
  "visibility": "company",
  "datasetId": "5b0c1f1e-6a63-4c0e-9d6f-0d9a3f2b7a11",
  "version": 1,
  "isLatest": true,
  "uploaderId": "…",
  "grantedUserIds": [],
  "createdAt": "2026-10-02T09:14:03.221Z"
}`,
    "Response",
  ),

  h2("5. Read the quality report"),
  p(
    "The report is built in the background, usually within seconds. Until it is ready, `status` is `queued` or `profiling`, so ask again shortly.",
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/files/FILE_ID/report \\
  -H "Authorization: Bearer gl_live_YOUR_KEY"`,
    },
    {
      label: "JavaScript",
      code: `const report = await (
  await fetch(\`${BASE}/files/\${file.id}/report\`, {
    headers: { Authorization: \`Bearer \${key}\` },
  })
).json();
console.log(report.status, report.qualityScore);`,
    },
  ),
  code(
    `{
  "fileId": "5b0c1f1e-…",
  "status": "ready",
  "metrics": {
    "rowCount": 1204,
    "columnCount": 6,
    "emptyRows": 0,
    "duplicateRows": 3,
    "columns": [
      { "name": "amount", "inferredType": "number", "nullPercent": 0.4, "inconsistent": false }
    ]
  },
  "narrative": { "summary": "…", "recommendations": ["…"], "model": "…" },
  "qualityScore": 92,
  "ruleResults": []
}`,
    "Response (shortened)",
  ),
  tip(
    "Rather than asking again and again, subscribe to the `report.ready` [webhook](/docs/webhooks) or watch [live updates](/docs/realtime).",
  ),

  h2("Where to next"),
  cards(
    {
      title: "Quality rules",
      text: "Say what good data means for your company.",
      href: "/docs/rules",
    },
    {
      title: "Versions",
      text: "Upload next month's export and see what changed.",
      href: "/docs/versions",
    },
    {
      title: "API keys and scopes",
      text: "Give a program only what it needs.",
      href: "/docs/api-keys",
    },
    {
      title: "Webhooks",
      text: "Get told when a report is ready.",
      href: "/docs/webhooks",
    },
  ),
];

export const QUICKSTART: Block[] = [
  p(
    "In about five minutes you will create a company, upload a spreadsheet and read the quality report Gridline writes for it. No code and no card needed. (Building something? The [API quickstart](/docs/api-quickstart) does the same from code.)",
  ),

  h2("1. Create your company"),
  steps(
    {
      title: "Open the sign-up page",
      text: "Choose **Create a company** on the home page or the sign-in page.",
    },
    {
      title: "Fill in the form",
      text: "Give your company's **name**, your **email**, a **password** of at least 8 characters, your **country** and your **industry**. Or choose **Continue with Google** and skip the password.",
    },
    {
      title: "Confirm your email",
      text: "Gridline sends an activation link. Open it, and nobody can sign in to your company until you have. If it does not arrive, ask for another from the sign-in page.",
    },
  ),

  h2("2. Sign in and choose a plan"),
  steps(
    {
      title: "Sign in",
      text: "Use your email and password, or Google.",
    },
    {
      title: "Choose Free",
      text: "The **Welcome** screen asks for a plan before anything else. Free needs no card and turns on at once, and you can change it whenever you like. See [Plans and billing](/docs/billing).",
    },
  ),
  tip(
    "Not ready to sign up? **Explore the demo** on the sign-in page opens a populated, read-only company, so you can look at real reports first. See [The demo company](/docs/demo).",
  ),

  h2("3. Upload a spreadsheet"),
  steps(
    {
      title: "Open Files",
      text: "Choose **Files** in the sidebar.",
    },
    {
      title: "Add a CSV or Excel file",
      text: "Drag it onto the dashed box, or choose **Choose files**. Up to 25 MB.",
    },
    {
      title: "Watch it appear",
      text: "It shows up at the top of the list straight away, with a stamp that says **Queued** and then **Checking**.",
    },
  ),

  h2("4. Read the quality report"),
  steps(
    {
      title: "Open the file",
      text: "Choose its row. After a few seconds the stamp turns into a **Checked** mark or a score out of 100, and the page fills in by itself.",
    },
    {
      title: "Read the report",
      text: "The **Report** tab shows what is in the file: rows, columns, empty cells, repeated rows, and what each column holds. The **Preview** tab shows its first rows.",
    },
  ),
  p(
    "There is no score yet because you have not told Gridline what good data means for you. That is the next step.",
  ),

  h2("5. Add a rule"),
  steps(
    {
      title: "Open Quality rules",
      text: "Choose **Quality rules** in the sidebar.",
    },
    {
      title: "Add one",
      text: "For example “at most 5% of the `email` column may be empty”. See [Quality rules](/docs/rules) for the seven kinds.",
    },
    {
      title: "Upload again, or choose Check again",
      text: "Every file from now on is checked against your rule. For the file you already uploaded, open its **Report** tab and choose **Check again**. Now it has a score and a list of which rules passed and failed.",
    },
  ),

  h2("Where to next"),
  cards(
    {
      title: "Versions",
      text: "Upload next month's export and see what changed.",
      href: "/docs/versions",
    },
    {
      title: "Share with your team",
      text: "Invite colleagues and choose who sees each file.",
      href: "/docs/people",
    },
    {
      title: "Build on Gridline",
      text: "API keys, webhooks and AI agents.",
      href: "/docs/api-quickstart",
    },
    {
      title: "Core concepts",
      text: "The seven ideas everything else is built from.",
      href: "/docs/concepts",
    },
  ),
];

export const CONCEPTS: Block[] = [
  p(
    "Gridline has a small vocabulary. Learn these seven words and every other guide will read easily.",
  ),

  h2("Company"),
  p(
    "A company is you and your organisation: the unit that signs up, chooses a plan, and pays. Everything Gridline stores belongs to exactly one company, and one company can never see another's data. If you ask for something that belongs to a different company, the answer is `404 Not Found`, as though it did not exist.",
  ),

  h2("People and roles"),
  p(
    "A company has people. The first person is the **admin**; the admin invites **employees**. Admins can do everything. Employees can upload, read the files they are allowed to see, and work with their own account.",
  ),
  table(
    ["", "Admin", "Employee"],
    ["Upload and read files they can see", "Yes", "Yes"],
    ["Share or delete their own files", "Yes", "Yes"],
    [
      "See every file in the company",
      "Yes",
      "Only company-wide files and ones shared with them",
    ],
    ["Invite and remove people", "Yes", "No"],
    ["Quality rules", "Create, edit, delete", "Read only"],
    ["Plans, billing and the audit log", "Yes", "No"],
  ),

  h2("File"),
  p(
    "A file is a spreadsheet you uploaded: CSV, XLS or XLSX. Gridline looks at the file's contents to decide what it is, never at its name. Each file has an owner (the person who uploaded it) and a visibility: the whole company, or only some people.",
  ),

  h2("Version"),
  p(
    "Data comes back: the March export, then April's. Instead of a pile of near-identical files, upload the next one as a **version** of the first. Gridline lists the file once, as its newest version, and can show exactly what changed between any two.",
  ),

  h2("Report"),
  p(
    "Every upload gets a **quality report**: how many rows and columns, how much is missing, which columns mix numbers and text, how many rows repeat, and a score out of 100. A short plain-language summary is added when it is available. The report is built in the background and never reads your cell values aloud.",
  ),

  h2("Rule"),
  p(
    'A **rule** is something you decide good data must satisfy, such as "the `email` column is at most 5% empty". Write it once and Gridline checks every upload against it. Each report shows which rules passed and which did not, and that drives the score.',
  ),

  h2("Plan"),
  p(
    "A plan sets how many files you can upload each billing period, how many people you can invite, how many rules and versions you can keep, and how many requests per minute your company can make. There are three: Free, Basic and Premium. See [Plans and billing](/docs/billing).",
  ),

  h2("Two ways to sign in"),
  ul(
    "**A session** is for a person using the dashboard. You sign in with a password or Google and get a short-lived token.",
    "**An API key** is for a program. It acts as the person who made it, limited to the scopes they chose.",
  ),
  p("Read [Authentication](/docs/authentication) for how both work."),
];

/** The first thing on the docs home: what Gridline is, in four short beats. */
export const OVERVIEW: Block[] = [
  p(
    "Gridline is where a company's spreadsheets live. Upload a CSV or Excel file and Gridline checks it on arrival, tells you what is wrong with it, remembers every version, and keeps it visible only to the people who should see it.",
  ),
  h2("How it works"),
  ol(
    "**Upload.** Drop a file in the dashboard, send it through the API, or let an AI agent do it.",
    "**Inspect.** Gridline reads it in the background and writes a quality report with a score.",
    "**Decide.** Your own rules say what good data means. A failure tells the people who need to know.",
    "**Track.** Each month's export becomes the next version, and a change that would break whatever reads the data is flagged the moment it lands.",
  ),
  h2("Start with what you need"),
  cards(
    {
      title: "I want to try it",
      text: "Make a company, upload a file and read its report, in five minutes.",
      href: "/docs/quickstart",
    },
    {
      title: "I want to understand it",
      text: "Seven ideas that everything else is built from.",
      href: "/docs/concepts",
    },
    {
      title: "I am building on it",
      text: "Sessions, API keys, webhooks, live updates and AI agents.",
      href: "/docs/api-quickstart",
    },
    {
      title: "Something is not working",
      text: "The errors people hit most, and the fix for each.",
      href: "/docs/troubleshooting",
    },
  ),
  note(
    "Looking for an endpoint? The [API reference](/reference) lists every one, with its parameters and responses, and is generated from the code so it cannot drift.",
  ),
];
