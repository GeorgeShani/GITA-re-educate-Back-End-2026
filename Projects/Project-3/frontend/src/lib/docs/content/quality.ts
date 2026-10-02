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

export const REPORTS: Block[] = [
  p(
    "Every file you upload is inspected. The result is a **quality report**: a plain account of what is in the file and how healthy it is. You never ask for it; it starts the moment the upload is saved.",
  ),

  h2("Get a report"),
  endpoint(
    "GET",
    "/files/{id}/report",
    "Needs files:read. Same access rule as the file.",
  ),
  p(
    "Reports are built in the background, usually in a few seconds, so check `status` first:",
  ),
  table(
    ["status", "Meaning"],
    ["`queued`", "Saved and waiting its turn."],
    ["`profiling`", "Being read right now."],
    [
      "`ready`",
      "Done. `metrics`, `narrative` and `qualityScore` are filled in.",
    ],
    [
      "`failed`",
      "The file could not be read (for example it is corrupt). `errorMessage` says why. Reading the same bytes again would not help, so it will not retry.",
    ],
    [
      "`unsupported`",
      "A legacy `.xls` file. It is stored and downloadable, but not profiled.",
    ],
  ),
  note(
    "If something goes wrong **temporarily** (storage or the database is briefly unavailable), Gridline retries on its own with a growing delay. Only a problem with the file itself ends as `failed`.",
  ),
  p(
    "Rather than asking repeatedly, you can [watch it live](/docs/realtime) or get a [webhook](/docs/webhooks) when it is ready.",
  ),

  h2("What is measured"),
  p("A ready report has these numbers for the whole file:"),
  fields(
    {
      name: "rowCount",
      type: "number",
      text: "Data rows, not counting the header.",
    },
    { name: "columnCount", type: "number", text: "Columns in the header." },
    {
      name: "emptyRows",
      type: "number",
      text: "Rows with nothing in any column.",
    },
    {
      name: "duplicateRows",
      type: "number",
      text: "Rows identical to an earlier row.",
    },
    {
      name: "raggedRows",
      type: "number",
      text: "Rows with more or fewer cells than the header.",
    },
    {
      name: "headerIssues",
      type: "string[]",
      text: "Problems with the header row: blank or repeated column names.",
    },
    {
      name: "truncated",
      type: "boolean",
      text: "`true` when the file was longer than Gridline profiles in one go. The numbers then cover the first 100,000 rows and 200 columns.",
    },
  ),
  p("And these for **each column**:"),
  fields(
    { name: "name", type: "string", text: "The header." },
    {
      name: "nullCount, nullPercent",
      type: "number",
      text: "How many cells are empty, and what percent of the column that is. A cell with only spaces counts as empty.",
    },
    {
      name: "inferredType",
      type: "string",
      text: "What most values are: `integer`, `number`, `boolean`, `date`, `string`, or `empty` for a column with nothing in it.",
    },
    {
      name: "typeCounts",
      type: "object",
      text: "How many cells of each kind there were.",
    },
    {
      name: "inconsistent, inconsistentPercent",
      type: "boolean, number",
      text: "Whether the column mixes kinds (numbers and text, say), and what percent of its values disagree with the dominant kind.",
    },
    {
      name: "numeric",
      type: "object | null",
      text: "For a numeric column: its `min`, `max` and `mean`.",
    },
  ),

  h2("The quality score"),
  p(
    "`qualityScore` is a number from 0 to 100 that says how the file did against **your rules**. It is the share of the rules that applied to this file and passed. A failed `error` rule counts twice as much as a failed `warning`. If no rule applied (you have none, or none matched this file) the score is `null`, because there is nothing to score against.",
  ),
  p(
    "Each report lists one result per rule in `ruleResults`: `passed`, `failed` or `skipped`, with a sentence saying what was found and what was required. See [Quality rules](/docs/rules).",
  ),

  h2("The plain-language summary"),
  p(
    "When it is available, `narrative` holds a short summary and a few recommendations, written by an AI model, and says which model wrote it. It is optional: if no model is configured, or it produces nothing usable, `narrative` is `null` and **everything else in the report is unaffected**.",
  ),
  note(
    "The model is shown only **aggregates**: column names, counts and percentages, and the average of a numeric column. It never sees a row or a single cell value, and it is told to treat column names as data, never as instructions.",
    "What the AI sees",
  ),

  h2("Preview the first rows"),
  endpoint("GET", "/files/{id}/preview", "Needs files:read."),
  p(
    "Returns the first 50 rows and 50 columns of the file, so you can glance at it without downloading. Long cells are cut at 200 characters and dates come back as ISO strings. The preview is saved when the report is built, so asking for it never reads the file again.",
  ),
  code(
    `{
  "columns": [{ "index": 0, "name": "order_id" }, { "index": 1, "name": "amount" }],
  "rows": [["A-1001", 49.9], ["A-1002", 12]],
  "totalRows": 1204,
  "truncated": true
}`,
    "Response",
  ),
  p(
    "It answers `409` while the report is still being built, and `422` (with the reason) if the report failed or the file is unsupported.",
  ),

  h2("Check a file against today's rules"),
  endpoint(
    "POST",
    "/files/{id}/report/rebuild",
    "Uploader or admin. Needs files:write.",
  ),
  p(
    "A report remembers the rules **as they were** when it was built, so changing a rule never rewrites an old report. After you change your rules, rebuild a report to check that file against the new ones.",
  ),
  tabs(
    {
      label: "curl",
      code: `curl -X POST ${BASE}/files/FILE_ID/report/rebuild \\
  -H "Authorization: Bearer gl_live_YOUR_KEY"`,
    },
    {
      label: "JavaScript",
      code: `await fetch(\`${BASE}/files/\${fileId}/report/rebuild\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${key}\` },
});`,
    },
  ),
  p(
    "The report goes back to `queued` and then `ready`. If one is already queued or running, you get `409`: it cannot be queued twice.",
  ),
];

export const RULES: Block[] = [
  p(
    "A **rule** is something you decide good data must satisfy. Write it once; Gridline checks **every upload** against all your rules and tells you which failed. This is what turns a report from a description into a verdict.",
  ),

  h2("The seven kinds of rule"),
  table(
    ["Kind", "In plain words", "Settings"],
    ["`required_column`", "The file must have this column.", "—"],
    [
      "`max_null_percent`",
      "At most this share of the column may be empty.",
      "`max`: 0 to 100",
    ],
    [
      "`type_is`",
      "The column must be this kind of data.",
      "`type`: `integer`, `number`, `boolean`, `date` or `string`; `maxInconsistentPercent`: 0 to 100 (default 0)",
    ],
    ["`min_value`", "No number may be below this.", "`min`"],
    ["`max_value`", "No number may be above this.", "`max`"],
    ["`unique`", "No value in the column may repeat.", "—"],
    [
      "`max_duplicate_rows`",
      "At most this many whole rows may repeat. This one is about the whole file, so it takes no column.",
      "`max`",
    ],
  ),
  p(
    "Rules look at a file's **statistics**, never its rows. They are about the shape and health of the data, so checking them never needs to read cell values.",
  ),

  h2("Create a rule"),
  endpoint(
    "POST",
    "/quality-rules",
    "Admins. An API key also needs the rules:write scope.",
  ),
  fields(
    {
      name: "name",
      type: "string",
      required: true,
      text: "What it is called in reports, up to 80 characters.",
    },
    {
      name: "kind",
      type: "string",
      required: true,
      text: "One of the seven kinds above. It can never be changed afterwards: delete the rule and make a new one.",
    },
    {
      name: "columnName",
      type: "string",
      text: "The column it applies to. Required for every kind except `max_duplicate_rows`. Matched to the file's header ignoring case.",
    },
    {
      name: "params",
      type: "object",
      text: "The settings for the kind, from the table above.",
    },
    {
      name: "severity",
      type: "error | warning",
      text: "Defaults to `error`. See below.",
    },
    {
      name: "enabled",
      type: "boolean",
      text: "Defaults to `true`. A disabled rule is kept but not checked.",
    },
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/quality-rules \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Emails are filled in",
    "kind": "max_null_percent",
    "columnName": "email",
    "params": { "max": 5 },
    "severity": "error"
  }'`,
    },
    {
      label: "JavaScript",
      code: `await fetch("${BASE}/quality-rules", {
  method: "POST",
  headers: { Authorization: \`Bearer \${accessToken}\`, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Emails are filled in",
    kind: "max_null_percent",
    columnName: "email",
    params: { max: 5 },
    severity: "error",
  }),
});`,
    },
  ),
  p("Other endpoints:"),
  ul(
    "`GET /quality-rules`: list your rules. Anyone in the company can read them, so an employee knows what an upload is checked against.",
    "`PATCH /quality-rules/{id}`: change the name, column, settings (they **replace** the old ones), severity or whether it is enabled.",
    "`DELETE /quality-rules/{id}`: remove it. Reports already built keep their result for it.",
  ),

  h2("Errors and warnings"),
  table(
    ["", "Counts in the score", "When it fails"],
    ["`error`", "Twice", "Notifies the uploader and every admin."],
    ["`warning`", "Once", "Only lowers the score. Nobody is notified."],
  ),
  p(
    "The notification names the **rules** that failed and the score. It never contains a value from the file.",
  ),

  h2("When a rule does not apply"),
  p(
    "Your rules cover every upload, but your files are different from each other. A file with no `amount` column is not wrong for an `amount` rule, so such a rule is **skipped** for that file, not failed. A skipped rule counts for nothing in the score.",
  ),
  tip(
    "If you want a column to be required, say so with a `required_column` rule. A missing column then fails that rule, and the rules about its contents are skipped.",
  ),

  h2("Limits"),
  table(
    ["Plan", "Rules you can keep"],
    ["Free", "3"],
    ["Basic", "25"],
    ["Premium", "No limit"],
  ),
  p(
    "Disabled rules count towards the limit. You can have at most **10** `unique` rules on any plan, because each is checked by remembering the values of its column. Going past a limit answers `409` with the reason. A downgrade that would leave you over the new plan's limit is refused until you delete some.",
  ),
  warn(
    "Rules are checked when a report is built. After changing rules, existing reports still show their old results until you [rebuild them](/docs/reports#check-a-file-against-today-s-rules).",
  ),
];

export const ACCESS: Block[] = [
  p(
    "Gridline answers two questions about every file: **who are you?** and **may you see it?** This guide explains both, and one rule that surprises people: a file you may not see is a `404`, not a `403`.",
  ),

  h2("Two roles"),
  p(
    "A company has **admins** and **employees**. The person who registers the company is its first admin. Admins invite everyone else.",
  ),
  table(
    ["", "Admin", "Employee"],
    ["Upload files, read the ones they may see", "Yes", "Yes"],
    [
      "See every file in the company",
      "Yes",
      "No: company-wide files, and ones shared with them",
    ],
    ["Change or delete a file", "Any file", "Only their own"],
    ["Invite and remove people", "Yes", "No"],
    ["Create, edit and delete quality rules", "Yes", "No (read only)"],
    ["Plans, billing, analytics and the audit log", "Yes", "No"],
    ["Webhooks", "Yes", "No"],
    ["Their own API keys", "Yes", "Yes (fewer scopes)"],
  ),

  h2("Who can see a file"),
  p("Every file has one of two visibilities:"),
  table(
    ["Visibility", "Who sees it"],
    ["`company`", "Everyone in the company. This is the default."],
    [
      "`restricted`",
      "The person who uploaded it, every admin, and the colleagues listed in `grantedUserIds`. Nobody else.",
    ],
  ),
  p(
    "This is one rule, applied the same way everywhere: the file list, a single file, its report and preview, its download link, its comments, GraphQL, live updates, and AI agents. There is no side door.",
  ),

  h2("Hidden means not found"),
  p("If you ask for a file you may not see, Gridline answers:"),
  code(`{ "statusCode": 404, "message": "File not found" }`, "Response"),
  p(
    'The same answer is given for a file that does not exist. That is deliberate: even saying "forbidden" would tell you that a file with that id exists. You only get `403 Forbidden` when you **can** see a file but are not allowed to change it (you are not its uploader or an admin).',
  ),
  note(
    "The same rule protects companies from each other. Anything that belongs to another company is simply `404`.",
  ),

  h2("Share a file with specific people"),
  p(
    "Set `visibility` to `restricted` when you upload, or change it later with `PATCH /files/{id}`. Pick colleagues with `GET /companies/me/members`, which returns just `id` and `fullName` for the active people in your company: enough to choose from, nothing more. It is for someone signed in with a session; an API key cannot list colleagues, so a program has to be given the ids.",
  ),
  tabs(
    {
      label: "curl",
      code: `# Who can I share with? (signed in as a person)
curl ${BASE}/companies/me/members \\
  -H "Authorization: Bearer ACCESS_TOKEN"

# Share only with them
curl -X PATCH ${BASE}/files/FILE_ID \\
  -H "Authorization: Bearer gl_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "visibility": "restricted", "grantedUserIds": ["USER_ID"] }'`,
    },
    {
      label: "JavaScript",
      code: `const members = await (
  await fetch("${BASE}/companies/me/members", {
    headers: { Authorization: \`Bearer \${accessToken}\` },
  })
).json(); // [{ id, fullName }, …]

await fetch(\`${BASE}/files/\${fileId}\`, {
  method: "PATCH",
  headers: { Authorization: \`Bearer \${key}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ visibility: "restricted", grantedUserIds: [members[0].id] }),
});`,
    },
  ),
  ul(
    "People you list must be active members of your company.",
    "Only the uploader and admins can see **who** a file is shared with (`grantedUserIds`), and only when they ask for that single file.",
    "Each person added is notified. The person who shared is not.",
    "Sharing a file never gives anyone any other file, and mentioning someone in a comment never gives them access.",
  ),

  h3("Versions"),
  p(
    "A new version starts with the same access as the file it joins, plus the person who uploaded it. After that, each version's access is its own.",
  ),

  h2("API keys cannot exceed their owner"),
  p(
    "An API key acts **as the person who created it, as they are right now**, narrowed to the scopes it was given. If that person is demoted or removed, their keys change with them on the very next request. See [API keys and scopes](/docs/api-keys).",
  ),
];
