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

export const FILES: Block[] = [
  p(
    "A file is a spreadsheet you give Gridline. Upload it once and your company can find it, share it, check it, keep its versions and talk about it. This guide shows how to upload, find, download and delete files.",
  ),

  h2("What you can upload"),
  table(
    ["Format", "Notes"],
    [
      "CSV",
      "Any separator (comma, semicolon, tab) is detected for you. UTF-8, with or without a byte-order mark.",
    ],
    [
      "XLSX",
      "Excel's current format. The first sheet that has any rows is read.",
    ],
    [
      "XLS",
      "Excel's older format. It is stored and can be downloaded, but it is not checked: its report says **Not checked**.",
    ],
  ),
  p(
    "Files can be up to **25 MB**. An empty file is refused, and so is anything that is not a spreadsheet.",
  ),
  note(
    "Gridline decides what a file is from its **contents**, never from its name. A program renamed to `report.csv` is refused, because what is inside is not a spreadsheet.",
    "A file's name does not matter",
  ),

  h2("Upload a file"),
  steps(
    {
      title: "Open Files",
      text: "Choose **Files** in the sidebar. At the top of the page is a dashed box that says **Drop spreadsheets here**.",
    },
    {
      title: "Decide who can see it",
      text: "Next to **Choose files** is a menu called **Who can see them**. **Whole company** is the default. Pick **Only me and admins** if the file is private; you can share it with particular colleagues afterwards (see [Sharing and access](/docs/access)).",
    },
    {
      title: "Add the files",
      text: "Drag one or more files onto the box, or choose **Choose files** and pick them. You can send several at once.",
    },
    {
      title: "Watch it arrive",
      text: "Each file shows its progress, then appears at the top of the list. Its **report** is built in the background, usually in a few seconds, and the stamp on its row changes by itself when it is ready: no need to reload.",
    },
  ),
  p(
    "If a file cannot be accepted, the reason is shown under the box in plain words, for example that only CSV, XLS and XLSX files can be uploaded, or that the file is over 25 MB. Nothing is stored and nothing counts against your plan.",
  ),

  h3("When you are over your quota"),
  p(
    "Each plan includes a number of files per billing period. Past it, what happens depends on the plan:",
  ),
  ul(
    "**Free and Basic** stop accepting uploads. The message names your plan, how many you have uploaded, and the date the allowance resets, so you know your options.",
    "**Premium** keeps accepting files and charges for each extra one. The upload still succeeds; the extra file is simply billed.",
  ),
  p(
    "A refused or failed upload uses none of your allowance. You are warned at 80% and 100% before it matters: see [Notifications and alerts](/docs/notifications).",
  ),

  h2("Find a file"),
  p(
    "**Files** lists every file you are allowed to see, each one once, as its newest version, with the newest upload first. Each row shows the file's name, its type and version, a stamp for its report, its size, who uploaded it and when.",
  ),
  p("Above the list are filters. Each narrows the list at once:"),
  table(
    ["Filter", "What it does"],
    ["**All types**", "Only CSV, XLSX or XLS files."],
    [
      "**Anyone can see**",
      "Only files shared with the **Whole company**, or only **Restricted** ones.",
    ],
    [
      "**Anyone uploaded**",
      "Only what one person uploaded. Admins see this filter; an employee only ever sees their own files and the ones shared with them anyway.",
    ],
    ["**Newest first**", "Switch to **Oldest first**."],
    [
      "**Every version**",
      "Tick it to list every version you can see, not only the newest of each file.",
    ],
  ),
  p(
    "Long lists load in pages. Choose **Load more** at the bottom for the next page.",
  ),
  tip(
    "A padlock and the word **Restricted** under a file's name mean it is not shared with the whole company.",
  ),

  h2("Open a file"),
  p(
    "Choose any row. The file's page has everything about it in four tabs: **Report**, **Preview**, **Versions** and **Comments**. Above them are the actions: **Download**, **Upload new version**, and, for its uploader and admins, **Sharing** and **Delete**.",
  ),
  p(
    "A file you are not allowed to see does not show up in the list, and its address shows a plain **not found** page. That is deliberate: see [Sharing and access](/docs/access).",
  ),

  h2("Download a file"),
  steps(
    {
      title: "Open the file",
      text: "Choose its row in **Files**.",
    },
    {
      title: "Choose Download",
      text: "Your browser starts downloading the original file, exactly as you uploaded it.",
    },
  ),
  p(
    "Gridline never passes your file through its own pages. It checks that you may see it, then gives your browser a private link that works for **5 minutes**. If a download link has expired, choose **Download** again.",
  ),

  h2("Change who can see a file"),
  p(
    "Only the person who uploaded a file, and admins, can change who sees it. Open the file and choose **Sharing**. How it works is in [Sharing and access](/docs/access).",
  ),

  h2("Delete a file"),
  steps(
    {
      title: "Open the file",
      text: "Only its uploader and admins see the **Delete** button.",
    },
    {
      title: "Choose Delete",
      text: "A box asks you to confirm and tells you what will happen.",
    },
    {
      title: "Confirm",
      text: "Choose **Delete version**. You are taken back to **Files**.",
    },
  ),
  p("Two things to know:"),
  ul(
    "Deleting does **not** give the upload back to your allowance: the upload happened.",
    "Deleting removes **one version**. If it was the newest, the version before it becomes the newest again. Version numbers are never reused.",
  ),
  warn(
    "Deleting is for the uploader and for admins. Someone who can see a file but did not upload it does not get the button.",
  ),

  h2("When something goes wrong"),
  table(
    ["You see", "What to do"],
    [
      "“Only CSV, XLS and XLSX files can be uploaded.”",
      "The file is some other kind. Export it as CSV or Excel and try again.",
    ],
    ["“This file is empty.”", "There is nothing in it to check."],
    [
      "“This file is over 25 MB.”",
      "Split it, or remove columns you do not need.",
    ],
    [
      "A message about your plan",
      "You have used your allowance for this period. It names the date it resets and the plan that raises it.",
    ],
    [
      "“Too many attempts”",
      "Your company has used its requests for this minute. Wait a moment and try again.",
    ],
  ),

  h2("From code"),
  p(
    "Everything on this page can be done over HTTP too: upload, list, download, share and delete. See [Files, versions and reports](/docs/files-api).",
  ),
];

export const VERSIONS: Block[] = [
  p(
    "Spreadsheets come back. The March export, then April's, then May's. Instead of a folder of near-identical files, upload each as the next **version** of the first. Gridline then shows you the file once, keeps the history, and can tell you exactly what changed between any two versions.",
  ),

  h2("Add a version"),
  steps(
    {
      title: "Open the file",
      text: "Choose it in **Files**. Any version will do.",
    },
    {
      title: "Choose Upload new version",
      text: "It is one of the buttons above the tabs.",
    },
    {
      title: "Pick the new file",
      text: "CSV, XLS or XLSX, up to 25 MB, the same as any upload. A percentage shows while it is sent.",
    },
    {
      title: "Land on the new version",
      text: "Gridline takes you to the new version's page. Its report is built in the background and fills in by itself.",
    },
  ),
  h3("What a version is"),
  ul(
    "**A real upload.** It counts toward your file allowance and gets its own quality report.",
    "**Numbered** 1, 2, 3 and so on. A number is never reused, even if a version is deleted.",
    "**Shared like the file it joins.** It takes the file's visibility and its list of people, plus the person who uploaded it, so an admin adding version 2 never locks out the employee who uploaded version 1. Colleagues are not notified again.",
    "**Limited by plan.** Free keeps up to 5 versions of a file, Basic 50, Premium any number. Past the limit you are asked to delete an old version or upgrade.",
  ),

  h2("See every version"),
  p(
    "Open a file and choose the **Versions** tab. It lists every version you may see, newest first, with its size, who uploaded it and when. The newest is marked **Latest** and the one you are looking at is marked **You are here**.",
  ),
  p(
    "If you open an older version, a yellow notice at the top says so and links to the latest.",
  ),

  h2("Compare two versions"),
  steps(
    {
      title: "Open the version you want to start from",
      text: "Usually the older one.",
    },
    {
      title: "Go to the Versions tab",
      text: "Each other version has a button, **Compare with version N**.",
    },
    {
      title: "Choose it",
      text: "The comparison always reads from the older version to the newer one, so a change reads forward in time.",
    },
  ),
  p(
    "Gridline compares the two **stored reports**, so nothing is read again and the answer is immediate. The page shows:",
  ),
  table(
    ["Section", "What it tells you"],
    [
      "**The banner**",
      "Green when no column was removed or changed type. Red when one was. That is the change that breaks whatever reads the file.",
    ],
    [
      "**The totals**",
      "Rows, columns, repeated rows and the quality score, before and after, with how far each moved. A lower score or more repeated rows shows in red; a better one in green.",
    ],
    [
      "**New columns** and **Columns that are gone**",
      "Matched by name, ignoring capitals. A renamed header shows as one gone and one new.",
    ],
    [
      "**Columns that now hold something different**",
      "For example numbers that became text.",
    ],
    [
      "**Noticeably more or fewer empty cells**",
      "Columns whose share of empty cells moved by 5 percentage points or more.",
    ],
  ),
  note(
    "When a new version removes or retypes a column its predecessor had, Gridline notifies the uploader and every admin straight away, so the break is noticed when the file lands, not when a dashboard goes wrong.",
    "You are told about breaking changes",
  ),

  h3("When a comparison cannot be made"),
  table(
    ["Message", "Why"],
    [
      "A page that says the file was not found",
      "You are not allowed to see one of the two versions.",
    ],
    [
      "The versions are not of the same file",
      "Comparing only works between versions of one file.",
    ],
    [
      "A report is still being built",
      "Wait a few seconds and open the comparison again.",
    ],
    [
      "A report failed or was not checked",
      "An old `.xls` file is stored but not checked, so it has nothing to compare.",
    ],
  ),

  h2("See which rows changed"),
  p(
    "The comparison above is about the shape of the file. Under it, **The rows** says which rows were added, removed or changed, and what each changed cell used to say.",
  ),
  steps(
    {
      title: "Choose the columns that identify a row",
      text: "A customer number, an order id, an email address. Gridline ticks one when a column's name says it is one. You can choose several, and the combination is used.",
    },
    {
      title: "Compare the rows",
      text: "Every row of both versions is lined up by those columns, in the background. Case and spaces around a key do not matter, and a reordered file does not look changed.",
    },
    {
      title: "Read the result",
      text: "Counts of rows added, removed, changed and unchanged; the columns that changed most; and the first 500 changes, each with the old value struck through. **Download all changes** is a CSV of every one.",
    },
  ),
  note(
    "A row whose key is empty, or appears more than once, cannot be matched. It is left out and counted, with a hint to choose a different column.",
  ),
  h3("Compare every new version automatically"),
  p(
    "Tick **Remember these columns for this file** and each new version is compared with the one before it as soon as its report is ready. The person who uploaded it and the admins are told, for example “Version 4 of customers.csv differs from the one before it: 120 added, 3 removed and 57 changed.” A `dataset.changed` webhook is sent too. Only the uploader of the file or an admin can save the columns.",
  ),

  h2("From code"),
  p(
    "Adding versions and comparing them are both available over HTTP: see [Files, versions and reports](/docs/files-api#versions-and-comparing).",
  ),
];

export const REPORTS: Block[] = [
  p(
    "Every file you upload is inspected. The result is a **quality report**: a plain account of what is in the file and how healthy it is. You never ask for it; it starts the moment the upload is saved.",
  ),

  h2("Find the report"),
  p(
    "Open a file and choose the **Report** tab (it is the one that opens first). The same stamp also appears on the file's row in **Files**:",
  ),
  table(
    ["Stamp", "Meaning"],
    ["**Queued**", "Saved and waiting its turn."],
    ["**Checking**", "Being read right now."],
    [
      "A number (for example **92**)",
      "Done. This is the quality score out of 100.",
    ],
    ["**Checked**", "Done, with no rules to score it against."],
    [
      "**Failed**",
      "The file could not be read, for example because it is damaged. The report says why. Reading the same file again would not help, so Gridline does not retry.",
    ],
    [
      "**Not checked**",
      "An old `.xls` file. It is stored and downloadable, but not read.",
    ],
  ),
  note(
    "If something goes wrong **temporarily** (storage or the database is briefly unavailable), Gridline retries by itself with a growing delay. Only a problem with the file itself ends as **Failed**.",
  ),
  p(
    "While a report is being built, the page says so and fills itself in when it finishes. You do not need to reload.",
  ),

  h2("The quality score"),
  p(
    "The score is a number from 0 to 100 that says how the file did against **your rules**. It is the share of the rules that applied to this file and passed. A failed **error** rule counts twice as much as a failed **warning**. If no rule applied (you have none, or none matched this file) there is no score, because there is nothing to score against.",
  ),
  table(
    ["Score", "How it reads"],
    ["80 to 100", "Green: the file looks healthy."],
    ["50 to 79", "Amber: the file needs a look."],
    ["0 to 49", "Red: the file has problems."],
  ),
  p(
    "Under the score, **Quality rules** lists one result per rule: **Passed**, **Failed**, **Warning** or **Skipped**, with a sentence saying what was found and what was required. See [Quality rules](/docs/rules).",
  ),

  h2("What is in the file"),
  p("A ready report counts these for the whole file:"),
  table(
    ["Figure", "Meaning"],
    ["**Rows**", "Data rows, not counting the header."],
    ["**Columns**", "Columns in the header."],
    ["**Empty rows**", "Rows with nothing in any column."],
    ["**Repeated rows**", "Rows identical to an earlier row."],
    ["**Uneven rows**", "Rows with more or fewer cells than the header."],
  ),
  p(
    "If the header row has blank or repeated names, the report lists those problems too. A very large file is read in part: the numbers then cover its first 100,000 rows and 200 columns, and the page says so.",
  ),
  p("Below that, a table describes **each column**:"),
  table(
    ["Column", "Meaning"],
    [
      "**Holds**",
      "What most of its values are: whole numbers, numbers, yes / no, dates, text, or empty.",
    ],
    [
      "**Empty**",
      "The share of cells with nothing in them. A cell with only spaces counts as empty.",
    ],
    [
      "**Mixed**",
      "The share of cells that do not match what the rest of the column holds, such as text among numbers.",
    ],
    [
      "**Lowest, Highest, Average**",
      "For a column of numbers: the smallest, the largest and the mean.",
    ],
  ),

  h2("In plain words"),
  p(
    "When it is available, the report opens with a short summary and a few recommendations, written by an AI model, and says which model wrote it. It is optional: if no model is available, or it produces nothing usable, that part is simply missing and **everything else in the report is unaffected**.",
  ),
  note(
    "The model is shown only **aggregates**: column names, counts and percentages, and the average of a numeric column. It never sees a row or a single cell value, and it is told to treat column names as data, never as instructions.",
    "What the AI sees",
  ),

  h2("Personal and secret data"),
  p(
    "Gridline looks at each column and says when it **looks like personal or secret data**: email addresses, phone numbers, payment card numbers, bank account numbers (IBAN), IP addresses, keys and tokens, and columns of birth dates. It does this with patterns and checksums, not with an AI model, so it is predictable, and a real card number has to pass the card checksum to count.",
  ),
  ul(
    "A flagged column carries a **Personal data** stamp in the table below, and the file gets one in **Files**. Use **Has personal data** in the filters to list them.",
    "If the file is **open to the whole company**, the uploader and every admin are told, because that is the moment to decide whether to restrict it. Restricting it is **Share**, above the tabs. If you open a file that holds personal data to everyone later, the same notice follows.",
    "Only the **kind** of data and **how much of the column** it covers are stored. The values themselves are never kept in the report and never sent to the AI.",
  ),
  note(
    "This is a pattern check, not a guarantee. It can flag a column by mistake (a column of version numbers can look like IP addresses) and it will miss personal data it has no pattern for, such as names. Treat it as a second pair of eyes.",
  ),
  tip(
    "To refuse such files outright, add a **No personal data** rule. It fails the file's report and tells the uploader and the admins.",
  ),

  h2("Workbooks with several sheets"),
  p(
    "A report covers **one sheet** of a workbook: the first one that has data. The report says which sheet it covers and lists the others. The uploader or an admin can choose **Check instead** to check another sheet; the choice is kept the next time the file is checked. Other sheets stay in the stored file and in downloads.",
  ),

  h2("Preview the first rows"),
  p(
    "Choose the **Preview** tab to glance at the file without downloading it. It shows the first 50 rows and 50 columns, with each column's type under its name. Long cells are cut at 200 characters and dates are shown in a standard form. The preview is saved when the report is built, so opening it never reads the file again.",
  ),
  p("Until the report is ready, or if it failed, there is no preview to show."),

  h2("Check a file against today's rules"),
  p(
    "A report remembers the rules **as they were** when it was built, so changing a rule never rewrites an old report. After you change your rules, open the file and choose **Check again** on its report to test it against the new ones. Only the uploader and admins see the button.",
  ),
  p(
    "The report goes back to **Queued** and then finishes again. If one is already being built, wait for it to finish first.",
  ),

  h2("Be told instead of watching"),
  p(
    "You do not have to keep the page open. Gridline puts **report ready** and **report failed** in your inbox (see [Notifications and alerts](/docs/notifications)), and developers can have the same news sent to their own system: see [Webhooks](/docs/webhooks).",
  ),

  h2("From code"),
  p(
    "The report, the preview and rebuilding are all available over HTTP: see [Files, versions and reports](/docs/files-api#quality-reports).",
  ),
];
