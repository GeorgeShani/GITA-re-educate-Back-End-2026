import { CompareTeaser } from "@/components/marketing/compare-teaser";
import { DevelopersBand } from "@/components/marketing/developers-band";
import { Exhibit } from "@/components/marketing/exhibit";
import { AccessViewer } from "@/components/marketing/exhibits/access-viewer";
import { AskResult } from "@/components/marketing/exhibits/ask-result";
import { CleanSteps } from "@/components/marketing/exhibits/clean-steps";
import { ColumnBars } from "@/components/marketing/exhibits/column-bars";
import { PersonalData } from "@/components/marketing/exhibits/personal-data";
import { RowChanges } from "@/components/marketing/exhibits/row-changes";
import { RuleList } from "@/components/marketing/exhibits/rule-list";
import { VersionDiff } from "@/components/marketing/exhibits/version-diff";
import { Hero } from "@/components/marketing/hero";
import { SecurityFacts } from "@/components/marketing/security-facts";

export default function Page() {
  return (
    <>
      <Hero />

      <Exhibit
        id="quality"
        hue="orange"
        title="A quality report for every upload, in seconds."
        visual={<ColumnBars />}
      >
        <p>
          Row and column counts, empty cells in every column, the type each
          column really holds, and duplicate rows. Optionally, a plain-language
          summary written from those statistics.{" "}
          <strong>The model never sees your rows.</strong>
        </p>
      </Exhibit>

      <Exhibit
        id="personal-data"
        hue="sienna"
        title="Find the personal data before it spreads."
        visual={<PersonalData />}
        flip
      >
        <p>
          Every report says which columns look like email addresses, phone
          numbers, card numbers, IBANs, IP addresses, birth dates or secret
          keys. It is found by patterns and checksums, so it is{" "}
          <strong>never an AI guessing</strong>, and a value is never shown. If
          a file like that is open to the whole company, the people who can fix
          it are told.
        </p>
      </Exhibit>

      <Exhibit
        id="rules"
        hue="grass"
        title="Hold every upload to your own rules."
        visual={<RuleList />}
      >
        <p>
          Require a column, cap empty cells, expect a type, set a minimum or
          maximum, demand unique values, or insist on{" "}
          <strong>no personal data</strong>. An error counts twice and a warning
          once, and the score follows.
        </p>
      </Exhibit>

      <Exhibit
        id="clean"
        hue="yellow"
        title="Fix what the report found, without touching your upload."
        visual={<CleanSteps />}
        flip
      >
        <p>
          Choose the steps: trim spaces, remove repeated rows, write dates and
          numbers one way, replace placeholders, hide a column of personal data.
          Gridline shows what each step would change across the{" "}
          <strong>whole file</strong>, then writes the result as the next
          version. Save the recipe, and on Basic and Premium every new upload is
          cleaned for you.
        </p>
      </Exhibit>

      <Exhibit
        id="versions"
        hue="teal"
        title="Every upload is the next version, and Gridline says what changed."
        visual={<VersionDiff />}
      >
        <p>
          Upload a new version of a dataset and it is compared with the last
          one. A removed or retyped column raises an alert to you and your
          admins, before anyone builds on it.
        </p>
      </Exhibit>

      <Exhibit
        id="changes"
        hue="ink"
        title="Not just that it changed. Which rows."
        visual={<RowChanges />}
        flip
      >
        <p>
          Name the column that identifies a row and Gridline lines two versions
          up row by row: how many were added, removed and changed, and the old
          and new value of every changed cell. Save the key and each new version
          is compared with the one before it. You hear{" "}
          <strong>“120 added, 3 removed, 57 changed”</strong> as it arrives.
        </p>
      </Exhibit>

      <Exhibit
        id="ask"
        hue="blue"
        title="Ask the file a question."
        visual={<AskResult />}
      >
        <p>
          Group, count and total every row with a query you build, or type{" "}
          <em>total revenue by region</em> and let the assistant fill it in. It
          sees your question and the column names, <strong>never a row</strong>,
          and the query it chose is shown so you can check it.
        </p>
      </Exhibit>

      <Exhibit
        id="access"
        hue="orange"
        title="Invisible, not forbidden."
        visual={<AccessViewer />}
        flip
      >
        <p>
          A file is open to the whole company or only to the people you name.
          Everyone else cannot open it, and cannot tell it exists. They get a{" "}
          <strong>not found</strong>, never an <strong>access denied</strong>.
        </p>
      </Exhibit>

      <DevelopersBand />
      <CompareTeaser />
      <SecurityFacts />
    </>
  );
}
