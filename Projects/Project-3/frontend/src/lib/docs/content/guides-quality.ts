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

export const RULES: Block[] = [
  p(
    "A **rule** is something you decide good data must satisfy. Write it once; Gridline checks **every upload** against all your rules and tells you which failed. This is what turns a report from a description into a verdict.",
  ),

  h2("The seven kinds of rule"),
  table(
    ["Kind", "In plain words", "For example"],
    [
      "Column is required",
      "The file must have this column.",
      "Every orders file has an `order_id` column.",
    ],
    [
      "Most empty cells",
      "At most this share of the column may be empty.",
      "`email` is at most 5% empty.",
    ],
    [
      "Column type",
      "The column must be this kind of data: whole numbers, numbers, yes / no, dates or text. You can allow a share of values to disagree (none, by default).",
      "`amount` is numbers.",
    ],
    [
      "Lowest value",
      "No number may be below this.",
      "`quantity` is never below 0.",
    ],
    [
      "Highest value",
      "No number may be above this.",
      "`discount` is never above 100.",
    ],
    [
      "Values are unique",
      "No value in the column may repeat.",
      "`order_id` never repeats.",
    ],
    [
      "Most repeated rows",
      "At most this many whole rows may repeat. This one is about the whole file, so it needs no column.",
      "No repeated rows at all.",
    ],
  ),
  p(
    "Rules look at a file's **statistics**, never its rows. They are about the shape and health of the data, so checking them never needs to read cell values.",
  ),

  h2("Add a rule"),
  p(
    "Only admins can add, change or delete rules. Everyone in the company can read them, so an employee knows what an upload is checked against.",
  ),
  steps(
    {
      title: "Open Quality rules",
      text: "Choose **Quality rules** in the sidebar.",
    },
    {
      title: "Choose Add a rule",
      text: "It is at the top right of the list, next to how many rules your plan allows, for example **3 of 25 rules on your plan**.",
    },
    {
      title: "Name it",
      text: "Pick a name that will read well in a report, such as “Emails are filled in”. Names can be up to 80 characters.",
    },
    {
      title: "Pick what to check",
      text: "Under **What to check**, choose one of the seven kinds above. This cannot be changed later: to use another kind, delete the rule and add a new one.",
    },
    {
      title: "Say which column",
      text: "Type the column's name as it appears in the file's header. Capitals do not matter. **Most repeated rows** is about the whole file, so it has no column.",
    },
    {
      title: "Set the limit",
      text: "Each kind asks for its own number, with a hint under it. For example, 5 for “at most 5% empty”.",
    },
    {
      title: "Choose how serious a failure is",
      text: "**Error** or **Warning**: see the next section. Error is the default.",
    },
    {
      title: "Add the rule",
      text: "Choose **Add rule**. It applies to every file uploaded from now on. Files already uploaded keep their old results until you choose **Check again** on their report.",
    },
  ),
  p(
    "Each rule in the list has three buttons: **Turn off** (or **Turn on**), **Edit** and **Delete**. A rule that is turned off is kept but not checked, and is marked **Off**. Editing shows the rule's kind but does not let you change it. Deleting asks you to confirm, and reports already built keep their result for the deleted rule.",
  ),

  h2("Errors and warnings"),
  table(
    ["", "Counts in the score", "When it fails"],
    ["**Error**", "Twice", "Tells the uploader and every admin."],
    ["**Warning**", "Once", "Only lowers the score. Nobody is notified."],
  ),
  p(
    "The notification names the **rules** that failed and the score. It never contains a value from the file.",
  ),

  h2("When a rule does not apply"),
  p(
    "Your rules cover every upload, but your files are different from each other. A file with no `amount` column is not wrong for an `amount` rule, so such a rule is **skipped** for that file, not failed. A skipped rule counts for nothing in the score.",
  ),
  tip(
    "If you want a column to be required, say so with a **Column is required** rule. A missing column then fails that rule, and the rules about its contents are skipped.",
  ),

  h2("Limits"),
  table(
    ["Plan", "Rules you can keep"],
    ["Free", "3"],
    ["Basic", "25"],
    ["Premium", "No limit"],
  ),
  p(
    "Disabled rules count towards the limit. On any plan you can have at most **10** “values are unique” rules, because each is checked by remembering the values of its column. Going past a limit is refused with the reason. A downgrade that would leave you over the new plan's limit is refused until you delete some.",
  ),
  warn(
    "Rules are checked when a report is built. After changing rules, existing reports still show their old results until you choose **Check again** on them. See [Quality reports](/docs/reports#check-a-file-against-today-s-rules).",
  ),

  h2("From code"),
  p(
    "Creating, listing, changing and deleting rules are available over HTTP, with every setting spelled out: see [Quality rules API](/docs/rules-api).",
  ),
];

export const ACCESS: Block[] = [
  p(
    "Gridline answers two questions about every file: **who are you?** and **may you see it?** This guide explains both, how to share a file with particular people, and one rule that surprises people: a file you may not see looks like it does not exist.",
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
  p(
    "Your role is checked on **every** request, not remembered from when you signed in. When an admin changes your role or removes you, it takes effect on your very next click.",
  ),

  h2("Who can see a file"),
  p("Every file has one of two visibilities:"),
  table(
    ["Visibility", "Who sees it"],
    ["**Whole company**", "Everyone in the company. This is the default."],
    [
      "**Restricted**",
      "The person who uploaded it, every admin, and the colleagues it is shared with. Nobody else.",
    ],
  ),
  p(
    "This is one rule, applied the same way everywhere: the file list, a single file, its report and preview, its download, its comments, live updates and AI agents. There is no side door.",
  ),

  h2("Share a file with particular people"),
  steps(
    {
      title: "Open the file",
      text: "Only its uploader and admins see the **Sharing** button.",
    },
    {
      title: "Choose Sharing",
      text: "A box opens: **Who can see this file**.",
    },
    {
      title: "Choose Only people I choose",
      text: "A list of your colleagues appears.",
    },
    {
      title: "Tick the people",
      text: "Each person you tick can see the file. The list **replaces** who had access before, so untick someone to take their access away.",
    },
    {
      title: "Save",
      text: "It takes effect on the next thing anyone does. Each person newly added is told a file was shared with them; you are not.",
    },
  ),
  p(
    "To open a file back up, choose **Everyone in the company** and save. That clears the list.",
  ),
  ul(
    "People you pick must be active members of your company.",
    "Only the uploader and admins can see **who** a file is shared with.",
    "Sharing a file never gives anyone any other file, and mentioning someone in a comment never gives them access.",
  ),

  h3("Versions"),
  p(
    "A new version starts with the same access as the file it joins, plus the person who uploaded it. After that, each version's access is its own.",
  ),

  h2("Hidden means not found"),
  p(
    "If you open a file you may not see, Gridline shows the same **not found** page as for a file that does not exist. That is deliberate: even saying “you are not allowed” would tell you that a file with that address exists.",
  ),
  p(
    "You only get a “not allowed” message when you **can** see a file but are not allowed to change it, because you are neither its uploader nor an admin. In practice you do not see the buttons at all.",
  ),
  note(
    "The same rule protects companies from each other. Anything that belongs to another company is simply not found.",
  ),

  h2("From code"),
  p(
    "Sharing is available over HTTP too: see [Files, versions and reports](/docs/files-api#sharing). What an API key may do is covered in [API keys and scopes](/docs/api-keys): a key never has more power than the person who made it.",
  ),
];
