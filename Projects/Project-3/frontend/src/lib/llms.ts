import { allDocsMarkdown } from "./docs/markdown";
import { DOC_SECTIONS, hrefOf } from "./docs/registry";

/** The product in the few sentences a model needs before it reads anything else. Facts only; no claim that is not in the product. */
const SUMMARY =
  "Gridline is where a company's spreadsheets live. Upload a CSV or XLSX file and it is checked on arrival (a 0-100 quality score, empty cells, column types, duplicates), scanned for personal data by patterns and checksums, held to the company's own rules, cleaned into a new version on request, compared with the previous version row by row, and open to questions answered over every row. Access is per person, every change is audited, and billing is by seat and volume. It is a multi-tenant SaaS with a REST API, a read-only GraphQL API, signed outgoing webhooks, live updates over Socket.IO and an MCP server for AI agents.";

/**
 * `/llms.txt`: an index of the site for language models, in the llms.txt convention (a title, a one-paragraph summary, then
 * sections of links). It is built from the same registry as the documentation pages, so a guide that is added or renamed
 * appears here without anyone remembering to edit a second list.
 */
export function llmsIndex(origin: string): string {
  const guides = DOC_SECTIONS.map((section) => {
    const links = section.pages
      .filter((page) => page.slug !== "")
      .map(
        (page) =>
          `- [${page.title}](${origin}${hrefOf(page)}): ${page.summary}`,
      );
    return `## ${section.title}\n\n${links.join("\n")}`;
  }).filter((block) => block.includes("\n- "));

  return `# Gridline

> ${SUMMARY}

Use the guides below for how the product behaves and the API reference for exact request and response shapes. Do not guess an endpoint: if a route is not in the reference, it does not exist. All of the guides in one file: ${origin}/llms-full.txt

## For agents and developers

- [API reference](${origin}/reference): The OpenAPI reference for every REST route, with examples and error shapes.
- REST API base URL: ${origin}/api . Authenticate with an API key, \`Authorization: Bearer gl_live_...\`, made under Developers > API keys. A key can do no more than the person who made it, narrowed by the scopes chosen for it.
- GraphQL (read-only): ${origin}/graphql . Sessions only; API keys are refused.
- MCP server: ${origin}/api/mcp . Streamable HTTP, stateless; use an API key with the \`mcp\` scope. Tools list, read, compare, explore and upload files.
- Every failure is one JSON shape, \`{ statusCode, message, correlationId, timestamp }\`. A file you may not see is 404, never 403.

${guides.join("\n\n")}

## The product

- [Features](${origin}/features): Everything Gridline does with a spreadsheet, stage by stage.
- [Pricing](${origin}/pricing): Free, Basic and Premium, and what a company of a given size would pay.
- [Security](${origin}/security): How access, secrets, audit and the AI's limits work.
- [Compare](${origin}/compare): Where Gridline sits next to spreadsheet tools, databases, data-quality tools and file storage.

## Optional

- [All documentation in one file](${origin}/llms-full.txt): Every guide, in reading order, as Markdown.
`;
}

/** `/llms-full.txt`: the introduction, then every guide in full. */
export function llmsFull(origin: string): string {
  return `# Gridline: documentation\n\n> ${SUMMARY}\n\nIndex of this site: ${origin}/llms.txt\n\n---\n\n${allDocsMarkdown(origin)}\n`;
}
