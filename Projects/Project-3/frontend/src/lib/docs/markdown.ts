import type { Block } from "./blocks";
import { DOC_BODIES } from "./content";
import { DOC_SECTIONS, type DocPage, hrefOf } from "./registry";

/** A link that stays on the site is written without the domain; a reader outside the site (a model) needs the full address. */
function absolute(href: string, origin: string): string {
  return href.startsWith("/") && !href.startsWith("//")
    ? `${origin}${href}`
    : href;
}

/** Guide text is already plain Markdown-ish (`code`, **bold**, [links](/docs/x)); only the site-relative links need the domain. */
function inline(text: string, origin: string): string {
  return text.replace(
    /\]\((\/[^)\s]*)\)/g,
    (_, href: string) => `](${absolute(href, origin)})`,
  );
}

const cell = (text: string, origin: string): string =>
  inline(text, origin).replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Folds the blocks of a guide into Markdown. Nothing is left out: a model reading this has no other copy of the guide. */
export function blocksToMarkdown(
  blocks: readonly Block[],
  origin: string,
  indent = "",
): string {
  const out: string[] = [];
  const line = (text: string) => out.push(text);

  for (const block of blocks) {
    switch (block.t) {
      case "p":
        line(inline(block.text, origin));
        break;
      case "h2":
        line(`## ${block.text}`);
        break;
      case "h3":
        line(`### ${block.text}`);
        break;
      case "ul":
        line(block.items.map((item) => `- ${inline(item, origin)}`).join("\n"));
        break;
      case "ol":
        line(
          block.items
            .map((item, index) => `${index + 1}. ${inline(item, origin)}`)
            .join("\n"),
        );
        break;
      case "steps":
        line(
          block.items
            .map((step, index) => {
              const head = `${index + 1}. **${step.title}**${step.text ? `: ${inline(step.text, origin)}` : ""}`;
              const nested = step.blocks
                ? `\n\n${blocksToMarkdown(step.blocks, origin).replace(/^/gm, "   ")}`
                : "";
              return head + nested;
            })
            .join("\n"),
        );
        break;
      case "code":
        line(
          `${block.label ? `**${block.label}**\n\n` : ""}\`\`\`\n${block.code}\n\`\`\``,
        );
        break;
      case "tabs":
        line(
          block.tabs
            .map((tab) => `**${tab.label}**\n\n\`\`\`\n${tab.code}\n\`\`\``)
            .join("\n\n"),
        );
        break;
      case "callout": {
        const label =
          block.title ??
          { note: "Note", warn: "Warning", tip: "Tip" }[block.tone];
        line(`> **${label}:** ${inline(block.text, origin)}`);
        break;
      }
      case "endpoint":
        line(
          `\`${block.method} ${block.path}\`${block.text ? `: ${inline(block.text, origin)}` : ""}`,
        );
        break;
      case "table":
        line(
          [
            `| ${block.head.map((head) => cell(head, origin)).join(" | ")} |`,
            `|${block.head.map(() => "---").join("|")}|`,
            ...block.rows.map(
              (row) =>
                `| ${row.map((value) => cell(value, origin)).join(" | ")} |`,
            ),
          ].join("\n"),
        );
        break;
      case "cards":
        line(
          block.items
            .map(
              (item) =>
                `- [${item.title}](${absolute(item.href, origin)}): ${inline(item.text, origin)}`,
            )
            .join("\n"),
        );
        break;
      case "fields":
        line(
          block.items
            .map((field) => {
              const facts = [field.type, field.required ? "required" : null]
                .filter(Boolean)
                .join(", ");
              return `- \`${field.name}\`${facts ? ` (${facts})` : ""}: ${inline(field.text, origin)}`;
            })
            .join("\n"),
        );
        break;
    }
  }
  return out
    .map((chunk) => (indent ? chunk.replace(/^/gm, indent) : chunk))
    .join("\n\n");
}

/** One guide as a Markdown document: its title, what it covers, then the whole text. */
export function pageToMarkdown(page: DocPage, origin: string): string {
  const body = DOC_BODIES[page.slug];
  const head = `# ${page.title}\n\n> ${page.summary}\n\nSource: ${origin}${hrefOf(page)}`;
  return body ? `${head}\n\n${blocksToMarkdown(body, origin)}` : head;
}

/** Every guide, in reading order, as one document: what `/llms-full.txt` serves. */
export function allDocsMarkdown(origin: string): string {
  return DOC_SECTIONS.flatMap((section) => section.pages)
    .filter((page) => page.slug !== "")
    .map((page) => pageToMarkdown(page, origin))
    .join("\n\n---\n\n");
}
