import type { components } from "@/lib/api/schema";

export type Scope = components["schemas"]["CreateApiKeyDto"]["scopes"][number];

export interface ScopeInfo {
  id: Scope;
  label: string;
  /** What a key holding it can do, in the words a person would use. */
  description: string;
  /** Only an admin can put it on a key; an employee's key can never hold it. */
  adminOnly: boolean;
}

export const SCOPES: readonly ScopeInfo[] = [
  {
    id: "files:read",
    label: "Read files",
    description:
      "List and open files, their reports, previews and comments, and read the plan and usage.",
    adminOnly: false,
  },
  {
    id: "files:write",
    label: "Upload and change files",
    description:
      "Upload files and new versions, rebuild reports, change who a file is shared with, and delete files.",
    adminOnly: false,
  },
  {
    id: "notifications:read",
    label: "Notifications",
    description: "Read your notifications and mark them read.",
    adminOnly: false,
  },
  {
    id: "billing:read",
    label: "Read billing",
    description: "Read the current bill and the invoices.",
    adminOnly: true,
  },
  {
    id: "rules:write",
    label: "Manage quality rules",
    description: "Create, edit and delete the company's data-quality rules.",
    adminOnly: true,
  },
  {
    id: "audit:read",
    label: "Read the audit log",
    description: "Read every entry of the company's audit log.",
    adminOnly: true,
  },
  {
    id: "mcp",
    label: "Connect an AI agent",
    description:
      "Lets an agent such as Claude connect through the MCP server. The agent sees only the tools your other scopes allow.",
    adminOnly: false,
  },
];

/** A scope's short name for a chip; an id this build has not heard of is shown as it came. */
export function scopeLabel(id: string): string {
  return SCOPES.find((scope) => scope.id === id)?.label ?? id;
}
