import type { ReactNode } from "react";
import { DocsHome } from "./home";
import { McpGuide } from "./mcp";

/**
 * The written guides, by slug. A guide that is not here is shown as "still being written", with its summary: the shell
 * and the table of contents are real, and nothing pretends a guide exists before it does.
 */
export const DOC_BODIES: Readonly<Record<string, () => ReactNode>> = {
  "": () => <DocsHome />,
  mcp: () => <McpGuide />,
};
