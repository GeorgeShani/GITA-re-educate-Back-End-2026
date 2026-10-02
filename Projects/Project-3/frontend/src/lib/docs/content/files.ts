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

export const FILES: Block[] = [
  p(
    "A file is a spreadsheet you give Gridline. Upload it once and the company can find it, share it, check it, version it and talk about it. This guide covers what you can upload, how it is accepted, and how to get it back out.",
  ),

  h2("What you can upload"),
  table(
    ["Format", "Notes"],
    [
      "CSV",
      "Any delimiter (comma, semicolon, tab) is detected for you. UTF-8, with or without a byte-order mark.",
    ],
    [
      "XLSX",
      "Excel's current format. The first sheet that has any rows is read.",
    ],
    [
      "XLS",
      "Excel's older format. It is stored and can be downloaded, but it is not profiled: its report says `unsupported`.",
    ],
  ),
  p(
    "Files can be up to **25 MB**. An empty file is refused, and so is anything that is not a spreadsheet.",
  ),
  note(
    "Gridline decides what a file is from its **contents**, never its name or the type your browser claims. A program renamed to `report.csv` is refused with a `400`, because its bytes are not a spreadsheet.",
    "A file's name does not matter",
  ),

  h2("Upload a file"),
  endpoint(
    "POST",
    "/files",
    "Needs the files:write scope when you use an API key.",
  ),
  fields(
    {
      name: "file",
      type: "file",
      required: true,
      text: "The spreadsheet, sent as `multipart/form-data`.",
    },
    {
      name: "visibility",
      type: "company | restricted",
      text: "Who may see it. Defaults to `company`: everyone in your company. See [Sharing and access](/docs/access).",
    },
    {
      name: "grantedUserIds",
      type: "string[]",
      text: "With `restricted`: the colleagues who may also see it. You and every admin always can. Repeat the field, or send a JSON array.",
    },
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/files \\
  -H "Authorization: Bearer gl_live_YOUR_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -F "file=@sales-q3.csv" \\
  -F "visibility=restricted" \\
  -F "grantedUserIds=USER_ID"`,
    },
    {
      label: "JavaScript",
      code: `const form = new FormData();
form.append("file", fileBlob, "sales-q3.csv");
form.append("visibility", "restricted");
form.append("grantedUserIds", userId);

const response = await fetch("${BASE}/files", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${key}\`,
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: form,
});`,
    },
  ),
  p(
    "The answer is `201` with the file. Its quality report is already queued: see [Quality reports](/docs/reports).",
  ),
  tip(
    "Send an `Idempotency-Key` with every upload. If your request times out and you send it again with the same key, you get the first answer back instead of a second file. See [Idempotent requests](/docs/idempotency).",
  ),

  h3("When you are over your quota"),
  p(
    "Each plan includes a number of files per billing period. Past it, what happens depends on the plan:",
  ),
  ul(
    "**Free and Basic** refuse the upload with `402 Payment Required`. The message names your plan, how many you have uploaded, and the date the quota resets.",
    "**Premium** accepts it and charges for the extra file. The response carries an `X-Gridline-Quota-Warning` header that says so.",
  ),
  p(
    "A refused or failed upload uses none of your quota. Two uploads racing for the last slot are handled one after the other, so you can never exceed the limit by accident.",
  ),

  h2("Find your files"),
  endpoint("GET", "/files", "Needs files:read."),
  p(
    "The list shows each file once, as its newest version, newest upload first. It returns only files you are allowed to see. Long lists use a cursor: see [Pagination](/docs/pagination).",
  ),
  fields(
    { name: "limit", type: "1–100", text: "How many per page. Default 20." },
    {
      name: "cursor",
      type: "string",
      text: "From `meta.nextCursor` of the previous page.",
    },
    {
      name: "sort",
      type: "-createdAt | createdAt",
      text: "Newest first (default) or oldest first.",
    },
    { name: "mimeType", type: "string", text: "Only CSV, XLS or XLSX files." },
    {
      name: "visibility",
      type: "company | restricted",
      text: "Only files shared this way.",
    },
    {
      name: "uploaderId",
      type: "uuid",
      text: "Only what one person uploaded.",
    },
    {
      name: "uploadedAfter / uploadedBefore",
      type: "ISO date-time",
      text: "A time window: after (inclusive) and before (exclusive).",
    },
    {
      name: "allVersions",
      type: "boolean",
      text: "`true` lists every version you can see, not just the newest of each file.",
    },
  ),
  endpoint("GET", "/files/{id}", "One file. A file you may not see is a 404."),

  h2("Download a file"),
  endpoint("GET", "/files/{id}/download"),
  p(
    "Gridline never serves your file through the API. It checks that you may see it, then hands you a short-lived link to fetch it directly.",
  ),
  code(
    `{
  "url": "https://…",
  "expiresAt": "2026-10-02T09:19:03.000Z"
}`,
    "Response",
  ),
  p(
    "The link works for **5 minutes** and needs no `Authorization` header. Ask again for a fresh one.",
  ),

  h2("Change who can see a file"),
  endpoint("PATCH", "/files/{id}", "Uploader or admin. Needs files:write."),
  tabs(
    {
      label: "curl",
      code: `curl -X PATCH ${BASE}/files/FILE_ID \\
  -H "Authorization: Bearer gl_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "visibility": "restricted", "grantedUserIds": ["USER_ID"] }'`,
    },
    {
      label: "JavaScript",
      code: `await fetch(\`${BASE}/files/\${fileId}\`, {
  method: "PATCH",
  headers: { Authorization: \`Bearer \${key}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ visibility: "restricted", grantedUserIds: [userId] }),
});`,
    },
  ),
  p(
    "`grantedUserIds` **replaces** the list of people who have access; it does not add to it. Switching to `company` clears it. New people on the list are notified that a file was shared with them.",
  ),

  h2("Delete a file"),
  endpoint("DELETE", "/files/{id}", "Uploader or admin. Needs files:write."),
  p(
    "Deleting removes the file from every list and download. Two things to know:",
  ),
  ul(
    "It does **not** give back the upload to your quota: the upload happened.",
    "If you delete the newest version of a file, the version before it becomes the newest again. Version numbers are never reused.",
  ),
  warn(
    "Deleting is for the uploader and for admins. Someone who can see a file but did not upload it gets `403 Forbidden`. Someone who cannot see it at all gets `404`.",
  ),

  h2("What can go wrong"),
  table(
    ["You see", "It means"],
    [
      "`400`",
      "The file is not a CSV, XLS or XLSX, is empty, or has a field the endpoint does not accept.",
    ],
    [
      "`402`",
      "You are over your plan's file quota, or the company has not chosen a plan yet.",
    ],
    [
      "`404`",
      "The file does not exist, or you may not see it. Gridline does not say which.",
    ],
    ["`413`", "The file is over 25 MB."],
    [
      "`429`",
      "Your company has used its requests for this minute. See [Rate limits](/docs/rate-limits).",
    ],
  ),
];

export const VERSIONS: Block[] = [
  p(
    "Spreadsheets come back. The March export, then April's, then May's. Instead of a folder of near-identical files, upload each as the next **version** of the first. Gridline then shows you the file once, keeps the history, and can tell you exactly what changed between any two.",
  ),

  h2("Add a version"),
  endpoint(
    "POST",
    "/files/{id}/versions",
    "Uploader or admin. Needs files:write.",
  ),
  p(
    "Send the new file in a field called `file`, exactly as for a normal upload. There are no other fields: a version takes its access from the file it joins.",
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/files/FILE_ID/versions \\
  -H "Authorization: Bearer gl_live_YOUR_KEY" \\
  -F "file=@sales-q4.csv"`,
    },
    {
      label: "JavaScript",
      code: `const form = new FormData();
form.append("file", fileBlob, "sales-q4.csv");

await fetch(\`${BASE}/files/\${fileId}/versions\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${key}\` },
  body: form,
});`,
    },
  ),
  p(
    "Use the id of any version of the file you want to add to. The answer is the new version: `version` is the next number, and `isLatest` is `true`.",
  ),
  h3("What a version is"),
  ul(
    "**A real upload.** It counts toward your file quota and gets its own quality report.",
    "**Numbered** 1, 2, 3 and so on. A number is never reused, even if a version is deleted.",
    "**Shared like the file it joins.** It takes the file's visibility and its list of people, and also the person who uploaded it, so an admin adding version 2 never locks out the employee who uploaded version 1. Colleagues are not notified again.",
    "**Limited by plan.** Free keeps up to 5 versions of a file, Basic 50, Premium any number. Past the limit you get `409` with the way forward: delete an old version or upgrade.",
  ),

  h2("See every version"),
  endpoint("GET", "/files/{id}/versions", "Needs files:read."),
  p(
    "Lists the versions of the file that you may see, newest first. Pass `?page=` and `?limit=` to move through them. In `GET /files`, add `allVersions=true` to list versions alongside other files.",
  ),

  h2("Compare two versions"),
  endpoint("GET", "/files/{id}/compare/{otherId}", "Needs files:read."),
  p(
    "Gridline compares the **stored reports** of the two versions, so nothing is read again and it answers immediately. Put the earlier version first.",
  ),
  tabs(
    {
      label: "curl",
      code: `curl ${BASE}/files/VERSION_1_ID/compare/VERSION_2_ID \\
  -H "Authorization: Bearer gl_live_YOUR_KEY"`,
    },
    {
      label: "JavaScript",
      code: `const diff = await (
  await fetch(\`${BASE}/files/\${v1}/compare/\${v2}\`, {
    headers: { Authorization: \`Bearer \${key}\` },
  })
).json();
if (diff.schemaChanged) console.warn("A column was removed or retyped");`,
    },
  ),
  code(
    `{
  "from": { "fileId": "…", "version": 1, "originalName": "sales-q3.csv" },
  "to":   { "fileId": "…", "version": 2, "originalName": "sales-q4.csv" },
  "columnsAdded": ["region"],
  "columnsRemoved": [],
  "typeChanges": [{ "column": "amount", "from": "integer", "to": "string" }],
  "nullPercentChanges": [{ "column": "email", "from": 1.2, "to": 9.8, "delta": 8.6 }],
  "rowCount":      { "from": 1204, "to": 1311, "delta": 107 },
  "columnCount":   { "from": 6, "to": 7, "delta": 1 },
  "duplicateRows": { "from": 3, "to": 3, "delta": 0 },
  "qualityScore":  { "from": 92, "to": 81, "delta": -11 },
  "schemaChanged": true
}`,
    "Response",
  ),
  fields(
    {
      name: "columnsAdded / columnsRemoved",
      type: "string[]",
      text: "Matched by name, ignoring case. A renamed header is one removed and one added.",
    },
    {
      name: "typeChanges",
      type: "array",
      text: "Columns whose dominant type changed, such as numbers that became text. A column that is empty on either side has no type to compare.",
    },
    {
      name: "nullPercentChanges",
      type: "array",
      text: "Columns whose share of empty cells moved by 5 percentage points or more.",
    },
    {
      name: "rowCount, columnCount, duplicateRows, qualityScore",
      type: "from / to / delta",
      text: "How each number moved.",
    },
    {
      name: "schemaChanged",
      type: "boolean",
      text: "`true` when a column was **removed** or **changed type**: the changes that break whatever reads the data. New columns and extra blanks do not count.",
    },
  ),
  note(
    "When a new version removes or retypes a column its predecessor had, Gridline notifies the uploader and every admin straight away, so the break is noticed when the file lands, not when a dashboard goes wrong.",
    "You are told about breaking changes",
  ),
  h3("When a comparison cannot be made"),
  table(
    ["Answer", "Why"],
    ["`404`", "You may not see one of the files."],
    [
      "`422`",
      "The files are not versions of the same file, or one report failed or is unsupported (an old `.xls`).",
    ],
    ["`409`", "One report is still being built. Ask again in a moment."],
  ),
];
