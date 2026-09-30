import { CompareTeaser } from "@/components/marketing/compare-teaser";
import { DevelopersBand } from "@/components/marketing/developers-band";
import { Exhibit } from "@/components/marketing/exhibit";
import { AccessViewer } from "@/components/marketing/exhibits/access-viewer";
import { ColumnBars } from "@/components/marketing/exhibits/column-bars";
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
        id="rules"
        hue="grass"
        title="Hold every upload to your own rules."
        visual={<RuleList />}
        flip
      >
        <p>
          Require a column, cap empty cells, expect a type, set a minimum or
          maximum, demand unique values. An error counts twice and a warning
          once, and the score follows.
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
        id="access"
        hue="blue"
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
