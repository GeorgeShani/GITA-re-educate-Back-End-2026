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
} from "../blocks";

export const EXPLORE: Block[] = [
  p(
    "A report describes a file. **Explore** answers questions about what is in it: how many rows per region, the total of a column, the highest value in each group. It is computed by Gridline over **every row** of the file, so the answer is the whole file's, not a sample's.",
  ),

  h2("Build a query"),
  steps(
    {
      title: "Open the Explore tab of a file",
      text: "It appears when the file's report is ready. Anyone who can see the file can use it.",
    },
    {
      title: "Say which rows, and how to group them",
      text: "**Only rows where** keeps the rows you care about (a region, a date after a day, a column that is not empty). **Group by** takes up to two columns and gives one line for each value.",
    },
    {
      title: "Choose what to work out",
      text: "The number of rows, the total, the average, the lowest or the highest of a number column, or how many different values a column has. Up to four at once.",
    },
    {
      title: "Read the answer",
      text: "It updates after every change, as a chart (when you group by one column) and a table. **Download as CSV** saves it for a spreadsheet.",
    },
  ),
  table(
    ["Condition", "Matches"],
    ["**is**", "The same text, ignoring case, or the same number."],
    ["**contains**", "Cells with that text inside, ignoring case."],
    [
      "**is more than** / **is less than**",
      "Numbers by value; anything else by text order, which puts dates written `2026-03-04` in the right order.",
    ],
    [
      "**is empty** / **is not empty**",
      "Blank cells, or cells with something.",
    ],
  ),
  note(
    "A total, average, lowest or highest skips cells that are not numbers and says how many it skipped. A column with no numbers in it cannot be added up, and Gridline says so rather than showing a zero.",
  ),

  h2("Ask in words"),
  p(
    "Type a question such as _total revenue by region, highest first_ and the assistant fills in the query for you. It is the same query as above, shown in the builder, so you can check what it chose and change it.",
  ),
  ul(
    "**The assistant never sees your data.** It is given your question and each column's name and kind (text, number, date), nothing else. Gridline runs the query it chooses on the file itself.",
    "**It cannot do more than the builder can.** What it returns is checked against the same rules, and a column that does not exist is refused.",
    "**Each answered question counts.** Free answers 20 a billing period, Basic 300 and Premium 3,000. The builder is free and unlimited, and a question the assistant cannot answer, or an assistant that is switched off, costs nothing.",
  ),
  tip(
    "Asking is quickest for the first draft of a query. Once the builder shows what you want, change it by hand: that is free.",
  ),

  h2("Limits"),
  ul(
    "Files of up to 100,000 rows and 200 columns, the size the report covers. A bigger file says so.",
    "Workbooks: the sheet the report covers. Choose another sheet on the report first.",
    "A file still being profiled can be explored once its report is ready.",
  ),

  h2("From code"),
  p(
    "Everything the page does is available over HTTP with the `files:read` scope.",
  ),
  endpoint(
    "POST",
    "/files/{id}/explore",
    'Runs a query. `{ "query": { "groupBy": ["region"], "measures": [{ "fn": "sum", "column": "revenue" }] } }`.',
  ),
  endpoint(
    "POST",
    "/files/{id}/ask",
    'A question in words: `{ "question": "revenue by region" }`. Returns the query it planned and the result.',
  ),
  endpoint(
    "GET",
    "/files/{id}/ask/allowance",
    "Whether the assistant is available, and how many questions are left this period.",
  ),
  h3("For AI agents"),
  p(
    "The MCP server has `explore_file` and `ask_file`, so an agent can analyse a file without downloading it, and `compare_version_rows` and `start_row_comparison` for the rows that changed between two versions.",
  ),
];
