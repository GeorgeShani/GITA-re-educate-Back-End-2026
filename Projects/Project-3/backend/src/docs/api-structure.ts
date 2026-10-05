import type { OpenAPIObject, PathItemObject } from '@nestjs/swagger';

/**
 * How the API reference is laid out: the order a reader meets things in, not the order Nest happened to register the
 * controllers. The product's own work comes first (files and what is done with them), then who may do it, what it costs,
 * and last the integration plumbing (keys, webhooks) and the system's own routes. Scalar draws the sidebar from this.
 *
 * Every tag a controller uses MUST be listed here. `organise` throws otherwise, so a new controller cannot quietly end up
 * wherever Nest registers it: the person adding it decides where it belongs.
 */
interface TagInfo {
  name: string;
  description: string;
}

interface Section {
  name: string;
  tags: readonly TagInfo[];
}

export const API_SECTIONS: readonly Section[] = [
  {
    name: 'Your data',
    tags: [
      {
        name: 'files',
        description:
          'The heart of Gridline. Upload a spreadsheet and its versions, read its quality report and preview, compare versions (statistics and, by key, row by row), clean it into a new version, group and total its rows, or ask it a question.',
      },
      {
        name: 'quality-rules',
        description: "The company's own checks (a required column, a limit on empty cells, no personal data…) that every report is held to.",
      },
      {
        name: 'comments',
        description: 'The discussion on a file, with mentions of colleagues who can already see it.',
      },
      {
        name: 'notifications',
        description: "A person's own inbox: report ready, rules failed, personal data found, rows changed, quota alerts.",
      },
      {
        name: 'analytics',
        description: 'How the company uses Gridline: uploads over time, storage and who uploads what.',
      },
    ],
  },
  {
    name: 'Accounts and people',
    tags: [
      {
        name: 'auth',
        description: 'Create a company, sign in (password or Google), keep a session alive, accept an invitation, link or unlink identities.',
      },
      { name: 'users', description: 'The signed-in person’s own profile.' },
      { name: 'companies', description: 'The company (the tenant): its details and its members.' },
      { name: 'employees', description: 'Inviting, listing, disabling and re-enabling the people in a company. Admins only.' },
    ],
  },
  {
    name: 'Plans and billing',
    tags: [
      { name: 'subscriptions', description: 'The plan catalog, and choosing or changing the company’s plan.' },
      { name: 'billing', description: 'The running bill, invoices, and the Stripe customer portal. Admins only.' },
    ],
  },
  {
    name: 'Governance',
    tags: [{ name: 'audit', description: 'The record of every change, which cannot be edited. Admins only.' }],
  },
  {
    name: 'Developers',
    tags: [
      { name: 'api-keys', description: 'Scoped keys that let a program act as the person who made them.' },
      {
        name: 'outgoing-webhooks',
        description: "Endpoints Gridline calls when something happens (a report is ready, a new version differs, personal data is found), with signed deliveries and a delivery log.",
      },
    ],
  },
  {
    name: 'System',
    tags: [
      { name: 'webhooks', description: 'Inbound notifications from Stripe. Called by Stripe, never by you.' },
      { name: 'health', description: 'Liveness and readiness for load balancers.' },
    ],
  },
];

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

function firstTag(item: PathItemObject): string | undefined {
  for (const method of HTTP_METHODS) {
    const tag = item[method]?.tags?.[0];
    if (tag) return tag;
  }
  return undefined;
}

/**
 * Puts the document in the order above: the top-level `tags` (with a sentence each), Scalar's `x-tagGroups` (the sections),
 * and the paths themselves grouped by tag, so even a tool that ignores both lists shows the main functionality first. Within
 * a tag the paths keep the order the controllers declare them in.
 */
export function organise(document: OpenAPIObject): OpenAPIObject {
  const ordered = API_SECTIONS.flatMap((section) => section.tags);
  const known = new Set(ordered.map((tag) => tag.name));

  const used = new Set<string>();
  for (const item of Object.values(document.paths)) {
    const tag = firstTag(item);
    if (tag) used.add(tag);
  }
  const unplaced = [...used].filter((tag) => !known.has(tag));
  if (unplaced.length > 0) {
    throw new Error(
      `API tag(s) ${unplaced.map((tag) => `"${tag}"`).join(', ')} are not placed in src/docs/api-structure.ts. Add each to a section there.`,
    );
  }

  const rank = new Map(ordered.map((tag, index) => [tag.name, index] as const));
  const paths = Object.entries(document.paths)
    .map(([path, item], index) => ({ path, item, index, rank: rank.get(firstTag(item) ?? '') ?? ordered.length }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  const present = (tag: TagInfo) => used.has(tag.name);
  return Object.assign(document, {
    paths: Object.fromEntries(paths.map(({ path, item }) => [path, item])),
    tags: ordered.filter(present).map(({ name, description }) => ({ name, description })),
    'x-tagGroups': API_SECTIONS.map((section) => ({
      name: section.name,
      tags: section.tags.filter(present).map((tag) => tag.name),
    })).filter((section) => section.tags.length > 0),
  });
}
