import Link from "next/link";
import { DemoButton } from "@/components/marketing/demo-button";
import { DevelopersBand } from "@/components/marketing/developers-band";
import { Exhibit } from "@/components/marketing/exhibit";
import { AccessViewer } from "@/components/marketing/exhibits/access-viewer";
import { AuditLog } from "@/components/marketing/exhibits/audit-log";
import { ColumnBars } from "@/components/marketing/exhibits/column-bars";
import { CommentThread } from "@/components/marketing/exhibits/comment-thread";
import { RuleList } from "@/components/marketing/exhibits/rule-list";
import { VersionDiff } from "@/components/marketing/exhibits/version-diff";
import { PageHead } from "@/components/marketing/page-head";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Features",
  description:
    "Quality reports, your own rules, versions, per-person access, an audit log, comments and a full API: what Gridline does with a spreadsheet.",
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
          Upload a CSV or XLSX file and it is checked on arrival, held to your
          rules, versioned, shared with exactly the people you name, and written
          into an audit log. Every capability below is in the product today.
        </p>
      </PageHead>

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
        id="rules"
        hue="grass"
        title="Your own rules, on every upload."
        visual={<RuleList />}
        flip
      >
        <p>
          Require a column, cap empty cells, expect a type, set a minimum or a
          maximum, demand unique values, limit duplicate rows. Each rule is an
          error or a warning. An error counts double in the score and raises an
          alert when it fails.
        </p>
        <p className="mt-4">
          A rule about a column a file does not have is skipped, not failed, so
          one company rule set can cover many different files. A report keeps
          the rules as they were when it ran.
        </p>
      </Exhibit>

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
        id="access"
        hue="blue"
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
