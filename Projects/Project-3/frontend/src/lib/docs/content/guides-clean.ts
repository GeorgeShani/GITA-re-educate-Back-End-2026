import {
  type Block,
  endpoint,
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

export const CLEANING: Block[] = [
  p(
    "A quality report tells you what is wrong with a file. **Clean** fixes it. You choose the steps (trim spaces, remove repeated rows, write dates one way, hide a column of personal data) and Gridline writes the result as the **next version** of the file. Your upload is never touched, so there is always a way back.",
  ),

  h2("Clean a file"),
  steps(
    {
      title: "Open the file and choose Clean",
      text: "It is next to **Upload new version**, and appears once the report is ready. Only the person who uploaded the file, or an admin, sees it.",
    },
    {
      title: "Look at the steps",
      text: "Gridline lists the steps that fit what the report found, and switches on the safe ones: it only offers to remove empty rows if there are some. Steps that change meaning (dates, hiding data, placeholders) are listed but off, until you turn them on.",
    },
    {
      title: "Read what would change",
      text: "Beside the steps, **What would change** counts what each step does across the **whole file**, and shows the first rows that change with each cell before and after. It updates as you edit.",
    },
    {
      title: "Create the cleaned version",
      text: "It is made in the background and checked by the same rules as any upload. When it is ready you land on the comparison with the file it came from.",
    },
  ),

  h2("The steps"),
  table(
    ["Step", "What it does"],
    [
      "**Trim spaces**",
      "Removes spaces at the start and end of cells, and doubled spaces inside them. One column or all.",
    ],
    ["**Tidy the header row**", "The same for the column names."],
    ["**Remove empty rows**", "Deletes rows with nothing in them."],
    [
      "**Remove repeated rows**",
      "Keeps the first of each. Put it after **Trim spaces** and it also finds rows that differed only by spaces.",
    ],
    [
      "**Write dates as YYYY-MM-DD**",
      "Reads `25/12/2025`, `4 Mar 2026`, `March 4, 2026` and ISO dates. A date like `03/04/2026` can be 3 April or 4 March, so you say which to assume, and the preview tells you how many were like that. Anything it cannot read is left alone, never guessed.",
    ],
    [
      "**Read text as numbers**",
      "Turns `1.234,50 €` or `$1,234.50` or `(2,000)` into a number. You say whether the decimal mark is a point or a comma. Percentages, ranges and words are left alone.",
    ],
    [
      "**Replace placeholders**",
      "Swaps `N/A`, `null`, `-` and the like for nothing, or for a value you choose.",
    ],
    [
      "**Fill empty cells**",
      "Puts a value into the empty cells of one column.",
    ],
    [
      "**Change letter case**",
      "Capitals, lower case or Title Case for a column.",
    ],
    [
      "**Rename** or **remove** a column",
      "Changes the header, or leaves the column out.",
    ],
    [
      "**Hide personal data**",
      "Replaces what a column holds: hide it completely, keep only the last four characters, or replace each value with a fingerprint (the same value always gives the same fingerprint, so you can still count and join on it, but nobody can read it).",
    ],
  ),
  note(
    "Steps run **in order**, top to bottom. A step about a column the file does not have is skipped, not refused, so a recipe still works on next month's file if a column has gone.",
  ),

  h2("What comes out"),
  ul(
    "**A new version.** Named like the file with “(cleaned)”, numbered after the newest version, shared with the same people.",
    "**The same kind of file.** A CSV stays a CSV and a workbook stays a workbook, with real numbers and real dates. A workbook keeps only the sheet that was cleaned; a legacy `.xls` comes out as `.xlsx`.",
    "**Not an upload.** It does not use your file allowance, because you did not upload it. It does count towards the number of versions your plan keeps, and it appears in the audit log as **File cleaned**.",
    "**Its own report.** Compare it with the version it came from to see the score rise and the problems go.",
  ),
  warn(
    "Cleaning reads the whole file, so it works on files of up to 100,000 rows and 200 columns, the same size the report covers. A bigger file is refused with that reason.",
  ),

  h2("Do it every month"),
  p(
    "Tick **Remember these steps for this file** and they are filled in the next time. On the Basic and Premium plans you can also tick **Clean every new version of this file automatically**: each upload is kept exactly as it arrived, and a cleaned version follows it. A cleaned version is never cleaned again.",
  ),
  tip(
    "Pair it with a **No personal data** rule: if a new upload ever holds data you did not expect, the report tells you, and the saved recipe can hide it.",
  ),

  h2("From code"),
  p(
    "Everything the page does is available over HTTP. Cleaning needs the `files:write` scope.",
  ),
  endpoint(
    "POST",
    "/files/{id}/clean/preview",
    "Counts what a recipe would do. Writes nothing.",
  ),
  endpoint(
    "POST",
    "/files/{id}/clean",
    "Starts it. Answers 202 with a job to poll.",
  ),
  endpoint(
    "GET",
    "/files/{id}/clean/jobs/{jobId}",
    "The job: `queued`, `running`, `succeeded` (with `resultFileId`) or `failed` (with the reason).",
  ),
  endpoint(
    "GET",
    "/datasets/{datasetId}/settings",
    "The saved recipe and whether every new version is cleaned.",
  ),
  endpoint("PUT", "/datasets/{datasetId}/settings", "Saves them."),
  h3("A recipe"),
  p(
    '`{ "steps": [ { "step": "trim_whitespace" }, { "step": "drop_duplicate_rows" }, { "step": "standardise_dates", "column": "joined", "order": "dmy" } ] }`',
  ),
];
