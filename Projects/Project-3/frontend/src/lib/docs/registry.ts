/** One guide. `slug` is its path under /docs ("" is the docs home). */
export interface DocPage {
  slug: string;
  title: string;
  /** One sentence: what the guide covers. Shown under the title and in search. */
  summary: string;
}

export interface DocSection {
  title: string;
  pages: readonly DocPage[];
}

/**
 * The guides, in the order a reader meets them: first what Gridline is and how to try it, then each feature in plain
 * words, then how to build on it, then the reference pages. Every entry describes something the product really does.
 */
export const DOC_SECTIONS: readonly DocSection[] = [
  {
    title: "Start here",
    pages: [
      {
        slug: "",
        title: "Overview",
        summary:
          "What Gridline is, what it does for a company, and where to begin.",
      },
      {
        slug: "quickstart",
        title: "Quickstart",
        summary:
          "Make a company, upload a spreadsheet and read its quality report, in about five minutes and without code.",
      },
      {
        slug: "concepts",
        title: "Core concepts",
        summary:
          "Companies, people, files, versions, reports and rules: the seven ideas everything else is built from.",
      },
    ],
  },
  {
    title: "Using Gridline",
    pages: [
      {
        slug: "files",
        title: "Files and uploads",
        summary:
          "Upload, find, download and delete spreadsheets, and what to do when an upload is refused.",
      },
      {
        slug: "versions",
        title: "Versions and comparing",
        summary:
          "Upload this month's export as the next version of the same file, and see exactly what changed.",
      },
      {
        slug: "reports",
        title: "Quality reports",
        summary:
          "What the Report and Preview tabs show: the score, every column, the plain-language summary.",
      },
      {
        slug: "cleaning",
        title: "Cleaning files",
        summary:
          "Fix what a report found: trim, de-duplicate, standardise dates and numbers, hide personal data, and save the result as the next version.",
      },
      {
        slug: "explore",
        title: "Exploring and asking",
        summary:
          "Group, count and total a file's rows, or ask a question in words. Computed over every row; the assistant never sees your data.",
      },
      {
        slug: "rules",
        title: "Quality rules",
        summary:
          "Say once what good data means for your company, and every upload is checked against it.",
      },
      {
        slug: "access",
        title: "Sharing and access",
        summary:
          "Admins and employees, company-wide and restricted files, how to share, and why a hidden file looks like it does not exist.",
      },
      {
        slug: "comments",
        title: "Comments and mentions",
        summary:
          "Talk about a file where it lives, reply in a thread and mention a colleague.",
      },
      {
        slug: "notifications",
        title: "Notifications and alerts",
        summary:
          "Your inbox and bell, the quota warnings at 80% and 100%, and what each message means.",
      },
      {
        slug: "people",
        title: "People",
        summary:
          "Invite colleagues, what an invitation costs, and what happens when someone leaves.",
      },
      {
        slug: "billing",
        title: "Plans and billing",
        summary:
          "Free, Basic and Premium, how you are charged, what happens past your allowance, and how payment recovery works.",
      },
      {
        slug: "analytics",
        title: "Usage analytics",
        summary:
          "Uploads per day, per person, storage, and whether you are on pace for your allowance.",
      },
      {
        slug: "audit-log",
        title: "The audit log",
        summary:
          "A record of everything that changed, who did it and when, that nobody can edit.",
      },
      {
        slug: "account",
        title: "Your account and company",
        summary:
          "Your name, password, Google sign-in, linked accounts and company details, under Settings.",
      },
      {
        slug: "demo",
        title: "The demo company",
        summary:
          "A populated, read-only company you can explore without signing up.",
      },
    ],
  },
  {
    title: "Build with the API",
    pages: [
      {
        slug: "api-quickstart",
        title: "API quickstart",
        summary:
          "Create a company, get an API key, upload a spreadsheet and read its report, all from code.",
      },
      {
        slug: "authentication",
        title: "Authentication",
        summary:
          "Sessions for people, API keys for programs, and how a token stays alive.",
      },
      {
        slug: "api-keys",
        title: "API keys and scopes",
        summary:
          "Create a key, choose what it may do, and why it is never more powerful than its owner.",
      },
      {
        slug: "files-api",
        title: "Files, versions and reports",
        summary:
          "Upload, list, download and share files; add versions, compare them and read reports.",
      },
      {
        slug: "rules-api",
        title: "Quality rules API",
        summary:
          "Create, list, change and delete rules, with every setting for each kind.",
      },
      {
        slug: "team-api",
        title: "Team and collaboration API",
        summary:
          "Comments, notifications and people: read, write and manage them over HTTP.",
      },
      {
        slug: "company-api",
        title: "Company and billing API",
        summary:
          "Plans, invoices, usage analytics, the audit log, and your account and company.",
      },
      {
        slug: "errors",
        title: "Errors",
        summary:
          "The one error shape every failure uses, and the status codes you will meet.",
      },
      {
        slug: "pagination",
        title: "Pagination",
        summary: "Cursors for long lists, page numbers for short ones.",
      },
      {
        slug: "idempotency",
        title: "Idempotent requests",
        summary:
          "Retry an upload or a plan change safely, so a timeout never costs you twice.",
      },
      {
        slug: "rate-limits",
        title: "Rate limits",
        summary:
          "A request budget per company per minute, and the headers that show what is left.",
      },
      {
        slug: "webhooks",
        title: "Webhooks",
        summary:
          "Signed events delivered to your own endpoint, with retries, and how to verify them.",
      },
      {
        slug: "realtime",
        title: "Live updates",
        summary:
          "Watch a report being built and a quota being used over one Socket.IO connection.",
      },
      {
        slug: "graphql",
        title: "GraphQL",
        summary:
          "A read-only graph of files, reports and usage for dashboards, in one request.",
      },
      {
        slug: "mcp",
        title: "Connect an AI agent (MCP)",
        summary:
          "Let Claude Code, Claude Desktop or Cursor list files, read reports and upload data with an API key.",
      },
      {
        slug: "ai-tools",
        title: "Docs for AI tools (llms.txt)",
        summary:
          "Point an assistant at /llms.txt or /llms-full.txt so it can read these guides, and when to use MCP instead.",
      },
    ],
  },
  {
    title: "Reference",
    pages: [
      {
        slug: "limits",
        title: "Limits at a glance",
        summary: "Every number in one place: plans, sizes, lifetimes and caps.",
      },
      {
        slug: "security",
        title: "Security and privacy",
        summary:
          "How companies are kept apart, what Gridline never reads, and how secrets are stored.",
      },
      {
        slug: "troubleshooting",
        title: "Troubleshooting",
        summary:
          "The errors people hit most often, what they mean and the fix.",
      },
    ],
  },
];

const ALL: readonly DocPage[] = DOC_SECTIONS.flatMap(
  (section) => section.pages,
);

/** The guide at a path under /docs, or `undefined` when there is none. */
export function findDoc(
  slug: readonly string[] | undefined,
): DocPage | undefined {
  const key = (slug ?? []).join("/");
  return ALL.find((page) => page.slug === key);
}

export function sectionOf(page: DocPage): DocSection | undefined {
  return DOC_SECTIONS.find((section) => section.pages.includes(page));
}

/** The guides either side of this one, in reading order, for the "previous / next" links. */
export function neighbours(page: DocPage): {
  previous: DocPage | undefined;
  next: DocPage | undefined;
} {
  const index = ALL.indexOf(page);
  return { previous: ALL[index - 1], next: ALL[index + 1] };
}

export function hrefOf(page: DocPage): string {
  return page.slug ? `/docs/${page.slug}` : "/docs";
}

export function allDocs(): readonly DocPage[] {
  return ALL;
}
