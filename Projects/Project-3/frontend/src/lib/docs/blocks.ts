/**
 * A guide is a list of blocks. Writing them as data (not JSX) keeps thirty guides short and identical in shape: a guide
 * says WHAT it contains, and `components/docs/blocks.tsx` decides how it looks.
 *
 * Text is plain, with three inline marks: `code`, **bold**, and [a link](/docs/files) (an address starting with / stays
 * on the site; anything else opens as a normal link).
 */
export type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface Step {
  title: string;
  text?: string;
  blocks?: Block[];
}

export interface Field {
  name: string;
  type?: string;
  text: string;
  required?: boolean;
}

export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "steps"; items: Step[] }
  | { t: "code"; code: string; label?: string }
  | { t: "tabs"; tabs: { label: string; code: string }[] }
  | {
      t: "callout";
      tone: "note" | "warn" | "tip";
      title?: string;
      text: string;
    }
  | { t: "endpoint"; method: Method; path: string; text?: string }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "cards"; items: { title: string; text: string; href: string }[] }
  | { t: "fields"; items: Field[] };

export const p = (text: string): Block => ({ t: "p", text });
export const h2 = (text: string): Block => ({ t: "h2", text });
export const h3 = (text: string): Block => ({ t: "h3", text });
export const ul = (...items: string[]): Block => ({ t: "ul", items });
export const ol = (...items: string[]): Block => ({ t: "ol", items });
export const steps = (...items: Step[]): Block => ({ t: "steps", items });
export const code = (source: string, label?: string): Block => ({
  t: "code",
  code: source,
  ...(label ? { label } : {}),
});
export const tabs = (...items: { label: string; code: string }[]): Block => ({
  t: "tabs",
  tabs: items,
});
export const note = (text: string, title?: string): Block => ({
  t: "callout",
  tone: "note",
  text,
  ...(title ? { title } : {}),
});
export const warn = (text: string, title?: string): Block => ({
  t: "callout",
  tone: "warn",
  text,
  ...(title ? { title } : {}),
});
export const tip = (text: string, title?: string): Block => ({
  t: "callout",
  tone: "tip",
  text,
  ...(title ? { title } : {}),
});
export const endpoint = (
  method: Method,
  path: string,
  text?: string,
): Block => ({ t: "endpoint", method, path, ...(text ? { text } : {}) });
export const table = (head: string[], ...rows: string[][]): Block => ({
  t: "table",
  head,
  rows,
});
export const cards = (
  ...items: { title: string; text: string; href: string }[]
): Block => ({ t: "cards", items });
export const fields = (...items: Field[]): Block => ({ t: "fields", items });

/** The address every sample sends to. Behind the proxy the API is at /api on the same domain as the app. */
export const BASE = "https://YOUR-DOMAIN/api";

/**
 * Folds a guide's blocks into a section of a bigger guide: its headings go down a level, so the bigger guide's own
 * headings stay on top. A third-level heading has nowhere lower to go, so it becomes a bold line.
 */
export function section(title: string, blocks: readonly Block[]): Block[] {
  return [
    h2(title),
    ...blocks.map((block): Block => {
      if (block.t === "h2") return h3(block.text);
      if (block.t === "h3") return p(`**${block.text}**`);
      return block;
    }),
  ];
}
