import Link from "next/link";
import { DemoButton } from "@/components/marketing/demo-button";
import { DevelopersBand } from "@/components/marketing/developers-band";
import { Exhibit } from "@/components/marketing/exhibit";
import { AccessViewer } from "@/components/marketing/exhibits/access-viewer";
import { AskResult } from "@/components/marketing/exhibits/ask-result";
import { AuditLog } from "@/components/marketing/exhibits/audit-log";
import { CleanSteps } from "@/components/marketing/exhibits/clean-steps";
import { ColumnBars } from "@/components/marketing/exhibits/column-bars";
import { CommentThread } from "@/components/marketing/exhibits/comment-thread";
import { PersonalData } from "@/components/marketing/exhibits/personal-data";
import { RowChanges } from "@/components/marketing/exhibits/row-changes";
import { RuleList } from "@/components/marketing/exhibits/rule-list";
import { VersionDiff } from "@/components/marketing/exhibits/version-diff";
import { PageHead } from "@/components/marketing/page-head";
import { StageHeading, StageIndex } from "@/components/marketing/stage-heading";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Features",
  description:
    "Quality reports, a personal-data scan, cleaning, row-by-row version changes, questions answered over every row, your own rules, per-person access, an audit log, comments and a full API: what Gridline does with a spreadsheet.",
};

export default function Page() {
  return (
    <>
      <PageHead
        title={["What Gridline", "does with a", "spreadsheet."]}
        actions={
          <>
            <Button variant="primary" size="lg" asChild>
              <Link href="/register">Start free</Link>
            </Button>
            <DemoButton size="lg" />
          </>
        }
      >
        <p>
          Upload a CSV or XLSX file and it is checked on arrival, scanned for
          personal data, held to your rules, cleaned if you ask, versioned and
          compared row by row, shared with exactly the people you name, open to
          your questions, and written into an audit log. Every capability below
          is in the product today.
        </p>
      </PageHead>

      <StageIndex />

      <StageHeading id="stage-check" />

      <Exhibit
        id="quality"
        hue="orange"
        title="A quality report for every upload."
        visual={<ColumnBars />}
      >
        <p>
          Within seconds of an upload you get row and column counts, empty cells
          per column, the type each column really holds, and duplicate rows.
          Optionally, a plain-language summary is written from those statistics.{" "}
          <strong>The model never sees your rows.</strong>
        </p>
        <p className="mt-4">
          CSV and XLSX files are profiled. A legacy XLS file is stored, listed
          and downloadable, but not profiled.
        </p>
      </Exhibit>

      <Exhibit
        id="personal-data"
        hue="sienna"
        title="A scan for personal and secret data."
        visual={<PersonalData />}
        flip
      >
        <p>
          Each report names the columns that look like email addresses, phone
          numbers, card numbers, IBANs, IP addresses, birth dates or secret keys
          (an API key or a private key pasted into a cell). Cards and IBANs must
          pass their checksum, so an order number is not mistaken for a card.
        </p>
        <p className="mt-4">
          It is found by patterns, never by an AI, and a value is never shown or
          sent anywhere. When a file with personal data is open to the whole
          company, the uploader and your admins are told, and a webhook can tell
          your own systems. A rule can also fail any file that has it.
        </p>
      </Exhibit>

      <Exhibit
        id="rules"
        hue="grass"
        title="Your own rules, on every upload."
        visual={<RuleList />}
      >
        <p>
          Require a column, cap empty cells, expect a type, set a minimum or a
          maximum, demand unique values, limit duplicate rows, or require that a
          file holds no personal data. Each rule is an error or a warning. An
          error counts double in the score and raises an alert when it fails.
        </p>
        <p className="mt-4">
          A rule about a column a file does not have is skipped, not failed, so
          one company rule set can cover many different files. A report keeps
          the rules as they were when it ran.
        </p>
      </Exhibit>

      <StageHeading id="stage-fix" />

      <Exhibit
        id="clean"
        hue="yellow"
        title="Clean a file into its next version."
        visual={<CleanSteps />}
        flip
      >
        <p>
          Pick steps from a short list: trim spaces, remove empty or repeated
          rows, write dates as YYYY-MM-DD, read text as numbers, replace
          placeholders such as N/A, fill empty cells, change case, rename or
          remove a column, and hide personal data (all of it, the last four
          characters, or a fingerprint you can still count and join on).
        </p>
        <p className="mt-4">
          Before anything is written, Gridline counts what each step would do
          across the <strong>whole file</strong> and shows the first rows that
          change. The result is the next version, with a report of its own. Your
          upload is never touched, and a cleaned version does not use your file
          allowance.
        </p>
        <p className="mt-4">
          Save the recipe for a file and it is there next month. On Basic and
          Premium, every new upload can be cleaned automatically, the original
          kept exactly as it arrived.
        </p>
      </Exhibit>

      <StageHeading id="stage-compare" />

      <Exhibit
        id="versions"
        hue="teal"
        title="Every upload is the next version."
        visual={<VersionDiff />}
      >
        <p>
          A new version of a dataset is compared with the last one from the two
          stored reports: rows, columns, empty cells, duplicates and the score.
          A removed or retyped column alerts you and your admins.
        </p>
        <p className="mt-4">
          Each version has its own report, its own access and its own place in
          the audit log. Deleting the newest version promotes the one before it.
        </p>
      </Exhibit>

      <Exhibit
        id="changes"
        hue="ink"
        title="Which rows changed, not just that something did."
        visual={<RowChanges />}
        flip
      >
        <p>
          The comparison above is about the shape of a file. Choose the column
          or columns that identify a row, such as a customer number, and two
          versions are lined up row by row: rows added, removed, changed and
          unchanged, which columns changed most, and the old and new value of
          each changed cell.
        </p>
        <p className="mt-4">
          The first 500 changes are browsable on the page, and{" "}
          <strong>Download all changes</strong> is a CSV of every one. Save the
          key and each new version is compared with the one before it as soon as
          its report is ready: the uploader and your admins are told how many
          rows were added, removed and changed, and a webhook says it too.
        </p>
      </Exhibit>

      <StageHeading id="stage-ask" />

      <Exhibit
        id="ask"
        hue="blue"
        title="Explore a file, or just ask it."
        visual={<AskResult />}
      >
        <p>
          Build a query from plain choices: filter rows, group by up to two
          columns, and work out a count, total, average, lowest, highest or the
          number of different values. It is computed by Gridline over{" "}
          <strong>every row</strong> (up to 100,000), shown as a chart and a
          table, and downloadable as CSV.
        </p>
        <p className="mt-4">
          Or type a question in words. The assistant is given your question and
          the column names and kinds, never a value, and answers with a query
          that Gridline checks and runs itself. You see the query it chose and
          can change it. Questions are counted by plan; the builder is free.
        </p>
      </Exhibit>

      <StageHeading id="stage-control" />

      <Exhibit
        id="access"
        hue="orange"
        title="Invisible, not forbidden."
        visual={<AccessViewer />}
        flip
      >
        <p>
          A file is open to the whole company or only to the people you name.
          Everyone else cannot open it and cannot tell it exists: they get a{" "}
          <strong>not found</strong>, never an <strong>access denied</strong>.
        </p>
        <p className="mt-4">
          New versions inherit the access of the file they extend, and changing
          access takes effect at once, even for someone watching the file live.
        </p>
      </Exhibit>

      <Exhibit
        id="audit"
        hue="sienna"
        title="A record that cannot be edited."
        visual={<AuditLog />}
      >
        <p>
          Uploads, access changes, rules, people, keys, plan changes and
          payments are written to the audit log in the same transaction as the
          change itself. Admins can filter it and open any entry.
        </p>
      </Exhibit>

      <Exhibit
        id="collaboration"
        hue="yellow"
        title="Talk about the file, where the file is."
        visual={<CommentThread />}
        flip
      >
        <p>
          Comment on a file and mention a colleague. Only someone who can
          already see the file can be mentioned, and a mention never grants
          access. See who else is looking at the file, and get notified in the
          app when a report is ready, a rule fails, a quota is close or a file
          is shared with you.
        </p>
      </Exhibit>

      <DevelopersBand />
    </>
  );
}
