import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Block, Method } from "@/lib/docs/blocks";
import { CodeTabs } from "./code-tabs";
import { Code } from "./prose";

/** `code`, **bold** and [links](/path): the only marks the guides use. Everything else is plain text. */
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

export function Inline({ text }: { text: string }): ReactNode {
  return text.split(INLINE).map((part, index) => {
    const key = `${index}-${part.slice(0, 12)}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link?.[1] && link[2]) {
      const [, label, href] = link;
      return href.startsWith("/") && !href.startsWith("/reference") ? (
        <Link key={key} href={href}>
          {label}
        </Link>
      ) : (
        <a key={key} href={href}>
          {label}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/** A heading's anchor: lower case words joined by hyphens, so the same title always gets the same link. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const METHOD_STYLE: Record<Method, string> = {
  GET: "border-pass bg-pass-soft text-pass",
  POST: "border-text bg-tag text-on-tag",
  PATCH: "border-caution bg-caution-soft text-caution",
  PUT: "border-caution bg-caution-soft text-caution",
  DELETE: "border-hold bg-hold-soft text-hold",
};

const CALLOUT = {
  note: { icon: Info, label: "Note", style: "border-line-strong bg-sunken" },
  tip: { icon: Lightbulb, label: "Tip", style: "border-pass bg-pass-soft" },
  warn: {
    icon: TriangleAlert,
    label: "Careful",
    style: "border-caution bg-caution-soft",
  },
} as const;

function BlockView({ block }: { block: Block }): ReactNode {
  switch (block.t) {
    case "p":
      return (
        <p>
          <Inline text={block.text} />
        </p>
      );
    case "h2":
      return <h2 id={slugify(block.text)}>{block.text}</h2>;
    case "h3":
      return <h3 id={slugify(block.text)}>{block.text}</h3>;
    case "ul":
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol>
          {block.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      );
    case "steps":
      return (
        <ol className="list-none! gap-6! pl-0!">
          {block.items.map((step, index) => (
            <li key={step.title} className="flex! gap-4">
              <span
                aria-hidden
                className="num mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-text bg-tag font-mono text-sm font-bold text-on-tag"
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <p className="font-semibold!">
                  <Inline text={step.title} />
                </p>
                {step.text ? (
                  <p>
                    <Inline text={step.text} />
                  </p>
                ) : null}
                {step.blocks ? <Blocks blocks={step.blocks} /> : null}
              </div>
            </li>
          ))}
        </ol>
      );
    case "code":
      return <Code label={block.label}>{block.code}</Code>;
    case "tabs":
      return <CodeTabs tabs={block.tabs} />;
    case "callout": {
      const { icon: Icon, label, style } = CALLOUT[block.tone];
      return (
        <aside className={cn("flex gap-3 rounded-md border p-4", style)}>
          <Icon aria-hidden className="mt-1 size-4 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold!">{block.title ?? label}</p>
            <p>
              <Inline text={block.text} />
            </p>
          </div>
        </aside>
      );
    }
    case "endpoint":
      return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line-strong bg-surface px-3 py-2">
          <span
            className={cn(
              "num rounded-xs border px-1.5 py-0.5 font-mono text-xs font-bold",
              METHOD_STYLE[block.method],
            )}
          >
            {block.method}
          </span>
          <code className="border-0! bg-transparent! p-0! font-mono text-sm">
            {block.path}
          </code>
          {block.text ? (
            <span className="text-sm text-text-muted">
              <Inline text={block.text} />
            </span>
          ) : null}
        </div>
      );
    case "table":
      return (
        <div className="leaf overflow-x-auto">
          <table className="w-full border-collapse text-left text-base">
            <thead>
              <tr className="border-b border-line-strong">
                {block.head.map((cell) => (
                  <th
                    key={cell}
                    scope="col"
                    className="px-3 py-2 font-semibold"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr
                  key={row.join("|")}
                  className="border-b border-line last:border-0"
                >
                  {row.map((cell, index) => (
                    <td
                      key={`${index}-${cell}`}
                      className="px-3 py-2 align-top text-base"
                    >
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "cards":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {block.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="leaf flex flex-col gap-1 p-4 no-underline! hover:bg-sunken"
            >
              <span className="font-semibold">{item.title}</span>
              <span className="text-sm font-normal text-text-muted">
                {item.text}
              </span>
            </Link>
          ))}
        </div>
      );
    case "fields":
      return (
        <dl className="flex flex-col divide-y divide-line rounded-md border border-line">
          {block.items.map((field) => (
            <div key={field.name} className="flex flex-col gap-1 px-4 py-3">
              <dt className="flex flex-wrap items-center gap-2">
                <code className="font-semibold">{field.name}</code>
                {field.type ? (
                  <span className="num font-mono text-xs text-text-muted">
                    {field.type}
                  </span>
                ) : null}
                {field.required ? (
                  <span className="text-xs font-semibold text-hold">
                    required
                  </span>
                ) : (
                  <span className="text-xs text-text-subtle">optional</span>
                )}
              </dt>
              <dd className="text-base text-text-muted">
                <Inline text={field.text} />
              </dd>
            </div>
          ))}
        </dl>
      );
  }
}

/** Draws a guide's blocks. Nothing here knows what a guide is about: only what each kind of block looks like. */
export function Blocks({ blocks }: { blocks: readonly Block[] }) {
  return (
    <>
      {blocks.map((block, index) => (
        <BlockView key={`${index}-${block.t}`} block={block} />
      ))}
    </>
  );
}
