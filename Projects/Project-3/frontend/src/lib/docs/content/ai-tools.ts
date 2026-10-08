import { BASE, type Block, code, h2, note, ol, p, table, tip } from "../blocks";

/** The site's own address, without the `/api` the samples add. */
const SITE = BASE.replace(/\/api$/, "");

export const AI_TOOLS: Block[] = [
  p(
    "Gridline publishes its documentation in two plain-text forms made for language models. An assistant that reads one of them can answer questions about Gridline and write correct API calls, without guessing at routes.",
  ),

  h2("The two files"),
  table(
    ["File", "What it is", "Use it when"],
    [
      `\`${SITE}/llms.txt\``,
      "A short index: what Gridline is, where the REST, GraphQL and MCP addresses are, and every guide with a one-line description.",
      "You want the assistant to find the right guide itself. Start here.",
    ],
    [
      `\`${SITE}/llms-full.txt\``,
      "Every guide in full, in reading order, as one Markdown file (about 170 KB).",
      "Your tool can take a whole document, or you want to keep the docs in a project's own knowledge.",
    ],
  ),
  p(
    "Both are built from the same list of guides as these pages, so they are always as current as the docs you are reading.",
  ),

  h2("Using them"),
  ol(
    `Open your assistant (Claude, ChatGPT, Cursor, or any tool that can read a web address) and give it the address: *Read ${SITE}/llms.txt, then help me upload a CSV with the API.*`,
    `Or add \`${SITE}/llms.txt\` to the tool's list of documentation or project knowledge, so it is there every time.`,
    "For a tool that cannot open web addresses, download `llms-full.txt` and attach it.",
  ),
  code(`curl ${SITE}/llms.txt`, "shell"),

  h2("What they do not do"),
  note(
    "These files describe Gridline and how to call it. They contain none of your data, and an assistant that has read them still cannot touch your account: it needs an API key for that.",
  ),
  tip(
    "To let an assistant actually list files, read reports and upload data, connect it with [MCP](/docs/mcp) instead. Use the files above to teach it, and MCP to let it act.",
  ),
];
