import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";

export const STAGES = [
  {
    id: "stage-check",
    number: "01",
    name: "Check",
    line: "What is in the file, and does it meet your rules.",
  },
  {
    id: "stage-fix",
    number: "02",
    name: "Fix",
    line: "Correct what the report found, without touching the upload.",
  },
  {
    id: "stage-compare",
    number: "03",
    name: "Compare",
    line: "What changed between one version and the next.",
  },
  {
    id: "stage-ask",
    number: "04",
    name: "Ask",
    line: "Answers from every row, without sending a row anywhere.",
  },
  {
    id: "stage-control",
    number: "05",
    name: "Control",
    line: "Who can see it, what was done, and how people talk about it.",
  },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

/** A band that says which stage of a file's life the next sections cover. */
export function StageHeading({ id }: { id: StageId }) {
  const stage = STAGES.find((candidate) => candidate.id === id);
  if (!stage) return null;
  return (
    <section
      id={stage.id}
      className="scroll-mt-16 border-t border-line-strong bg-sunken"
    >
      <Reveal className="mx-auto flex w-full max-w-6xl flex-wrap items-baseline gap-x-6 gap-y-1 px-6 py-8">
        <span className="font-mono text-sm tabular-nums text-text-subtle">
          {stage.number}
        </span>
        <h2 className="headline text-3xl leading-none sm:text-4xl">
          {stage.name}
        </h2>
        <p className="text-base text-text-muted">{stage.line}</p>
      </Reveal>
    </section>
  );
}

/** Jump links to each stage, under the page head. */
export function StageIndex() {
  return (
    <nav
      aria-label="Stages of a file"
      className="border-b border-line bg-surface"
    >
      <ul className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-6 gap-y-2 px-6 py-3 text-sm">
        {STAGES.map((stage) => (
          <li key={stage.id}>
            <Link
              href={`#${stage.id}`}
              className="link-draw font-medium text-text-muted hover:text-text"
            >
              <span className="mr-1.5 font-mono tabular-nums text-text-subtle">
                {stage.number}
              </span>
              {stage.name}
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="#developers"
            className="link-draw font-medium text-text-muted hover:text-text"
          >
            <span className="mr-1.5 font-mono tabular-nums text-text-subtle">
              06
            </span>
            Build
          </Link>
        </li>
      </ul>
    </nav>
  );
}
