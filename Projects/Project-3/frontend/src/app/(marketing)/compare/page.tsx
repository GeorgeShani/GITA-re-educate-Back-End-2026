import type { ReactNode } from "react";
import type { Hue } from "@/components/marketing/hues";
import { HUES } from "@/components/marketing/hues";
import { PageHead } from "@/components/marketing/page-head";
import { Reveal } from "@/components/motion/reveal";
import { cssVars } from "@/lib/css-vars";

export const metadata = {
  title: "Compare",
  description:
    "Gridline next to spreadsheet tools, Airtable and Smartsheet, data-quality tools and file storage: what each is built for, and when to keep it.",
};

interface Comparison {
  id: string;
  hue: Hue;
  name: string;
  examples: string;
  builtFor: string;
  differs: string;
  keep: string;
  together: string;
}

const COMPARISONS: Comparison[] = [
  {
    id: "spreadsheets",
    hue: "orange",
    name: "Spreadsheet tools",
    examples: "Excel, Google Sheets",
    builtFor:
      "Editing and analysing data: formulas, pivots, charts, and working on the numbers together.",
    differs:
      "Gridline checks a file that arrives. Your rules run on every upload, a score comes back, each new version is compared with the last, and only the people you name can open it.",
    keep: "Any time you need to change or calculate something. Gridline does not edit your data.",
    together:
      "Upload the exported file to Gridline first, and open it in the spreadsheet once it has passed.",
  },
  {
    id: "databases",
    hue: "grass",
    name: "Airtable and Smartsheet",
    examples: "Airtable, Smartsheet",
    builtFor:
      "Building the tables, views and workflows a team runs its work in.",
    differs:
      "Gridline is where files land, not where a process runs. Every version is kept and compared, access is set per person per file, and every change is written to an audit log that cannot be edited.",
    keep: "Managing projects, records and automations.",
    together: "Import a file into them only after Gridline has checked it.",
  },
  {
    id: "quality-tools",
    hue: "teal",
    name: "Data-quality tools",
    examples: "Great Expectations and similar",
    builtFor:
      "Validating data inside pipelines, usually configured and operated by engineers.",
    differs:
      "Gridline is where the whole team uploads and shares files, with rules an admin sets in the app and a report a non-engineer can read. The same rules are reachable through an API, and results arrive as signed webhooks for your pipeline.",
    keep: "Testing warehouse tables and pipeline stages at scale.",
    together:
      "Use Gridline at the door where people hand over files, and your pipeline tool deeper inside.",
  },
  {
    id: "storage",
    hue: "blue",
    name: "Box and Dropbox",
    examples: "Box, Dropbox",
    builtFor: "Storing and syncing files of every kind, in folders you share.",
    differs:
      "Gridline stores spreadsheets only, and tells you what is inside them: a quality report, your rules, versions compared, an alert when a column disappears. A file someone may not see is not found, rather than merely denied.",
    keep: "Everything that is not a spreadsheet: documents, images, video, large files, desktop sync.",
    together:
      "Leave the folder tree where it is and send the spreadsheets that matter through Gridline.",
  },
];

const NOT_FOR = [
  [
    "Editing",
    "Gridline never changes the file you uploaded, and it does not open cells for editing.",
  ],
  [
    "Every kind of file",
    "Only CSV, XLSX and XLS, up to 25 MB. Legacy XLS files are stored but not profiled.",
  ],
  [
    "Very large data",
    "A report profiles the first 100,000 rows and 200 columns of a file, and says so when it stops there.",
  ],
  [
    "Running your pipeline",
    "Gridline tells your pipeline what it found. It does not run the pipeline.",
  ],
] as const;

export default function Page() {
  return (
    <>
      <PageHead title={["Gridline next to", "what you already use."]}>
        <p>
          You do not have to give up the tools you have. Gridline sits where
          files arrive, and this page says plainly what each kind of tool is
          built for and where Gridline is the wrong answer.
        </p>
        <p className="mt-4 text-base text-text-subtle">
          As of September 2026. These are descriptions of what each category is
          built for, not feature-by-feature audits. Check a vendor&rsquo;s own
          documentation before deciding.
        </p>
      </PageHead>

      {COMPARISONS.map((entry) => (
        <section
          key={entry.id}
          id={entry.id}
          style={cssVars({ "--division": `var(${HUES[entry.hue].cssVar})` })}
          className="scroll-mt-16 border-b border-line"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
            <Reveal className="flex flex-col gap-3">
              <h2 className="headline text-4xl leading-[0.98] sm:text-5xl">
                {entry.name}
              </h2>
              <p className="text-sm text-text-subtle">{entry.examples}</p>
            </Reveal>
            <Reveal delay={120} className="min-w-0">
              <dl
                style={{ borderTopWidth: 5, borderTopColor: "var(--division)" }}
                className="leaf grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2 md:p-8"
              >
                <Item term="Built for">{entry.builtFor}</Item>
                <Item term="Where Gridline differs">{entry.differs}</Item>
                <Item term="Keep it for">{entry.keep}</Item>
                <Item term="Using both">{entry.together}</Item>
              </dl>
            </Reveal>
          </div>
        </section>
      ))}

      <section>
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <Reveal>
            <h2 className="headline text-4xl leading-[0.98] sm:text-5xl">
              Where Gridline is not the answer.
            </h2>
          </Reveal>
          <Reveal delay={120} className="min-w-0">
            <ul className="border-t border-line-strong">
              {NOT_FOR.map(([term, text]) => (
                <li
                  key={term}
                  className="grid gap-1 border-b border-line py-5 sm:grid-cols-[11rem_1fr] sm:gap-6"
                >
                  <span className="text-md font-semibold">{term}</span>
                  <span className="copy text-text-muted">{text}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function Item({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-sm font-semibold text-text-subtle">{term}</dt>
      <dd className="copy text-text">{children}</dd>
    </div>
  );
}
