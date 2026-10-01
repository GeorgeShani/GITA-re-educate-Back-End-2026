/** One guide. `slug` is its path under /docs ("" is the docs home). */
export interface DocPage {
  slug: string;
  title: string;
  /** One sentence: what the guide covers. Shown under the title, in search, and when no written guide exists yet. */
  summary: string;
}

export interface DocSection {
  title: string;
  pages: readonly DocPage[];
}

/**
 * The guides, in the order a reader meets them. Every entry is something the API really does; the written guide for each
 * is added as it is finished (see `lib/docs/content`), and an entry without one says so rather than pretending.
 */
export const DOC_SECTIONS: readonly DocSection[] = [
  {
    title: "Start here",
    pages: [
      {
        slug: "",
        title: "Overview",
        summary:
          "What Gridline is, how a company's data is kept apart, and where to begin.",
      },
      {
        slug: "quickstart",
        title: "Quickstart",
        summary:
          "Create a company, upload a spreadsheet and read its quality report.",
      },
    ],
  },
  {
    title: "Concepts",
    pages: [
      {
        slug: "files",
        title: "Files and versions",
        summary:
          "How an upload becomes a file, how later uploads become versions, and how they are compared.",
      },
      {
        slug: "reports",
        title: "Quality reports",
        summary:
          "What is measured about each column, the score, and why cell values are never read aloud.",
      },
      {
        slug: "rules",
        title: "Rules",
        summary:
          "The checks your company holds every upload to, and how a rule is weighed.",
      },
      {
        slug: "access",
        title: "Access and roles",
        summary:
          "Admins and employees, company-wide and restricted files, and why a hidden file is a 404.",
      },
    ],
  },
  {
    title: "The API",
    pages: [
      {
        slug: "authentication",
        title: "Authentication",
        summary:
          "Sessions for people, API keys for programs, and what each is allowed to reach.",
      },
      {
        slug: "api-keys",
        title: "API keys and scopes",
        summary:
          "Creating a key, the scopes it can hold, and why it is never more powerful than its owner.",
      },
      {
        slug: "errors",
        title: "Errors",
        summary:
          "The one error shape every failure uses, and the correlation id that finds it in the logs.",
      },
      {
        slug: "pagination",
        title: "Pagination",
        summary: "Cursors for long lists, page numbers for short ones.",
      },
      {
        slug: "idempotency",
        title: "Idempotent uploads",
        summary:
          "Retrying an upload safely with an Idempotency-Key, so a timeout never costs a second file.",
      },
      {
        slug: "rate-limits",
        title: "Rate limits",
        summary:
          "A budget per company per minute, shared by every person and key, and the headers that show it.",
      },
    ],
  },
  {
    title: "Integrations",
    pages: [
      {
        slug: "webhooks",
        title: "Webhooks",
        summary:
          "Signed event deliveries to your own endpoint, with retries and how to verify them.",
      },
      {
        slug: "realtime",
        title: "Live updates",
        summary:
          "The Socket.IO connection that shows a report being built and a quota being used.",
      },
      {
        slug: "graphql",
        title: "GraphQL",
        summary:
          "A read-only graph of files, reports and usage for dashboards.",
      },
      {
        slug: "mcp",
        title: "Connect an AI agent (MCP)",
        summary:
          "Let Claude Code, Claude Desktop or Cursor list files, read reports and upload data with an API key.",
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
