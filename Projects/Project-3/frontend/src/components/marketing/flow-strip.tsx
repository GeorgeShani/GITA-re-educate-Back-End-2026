import {
  ArrowRight,
  Eraser,
  Lock,
  MessageCircleQuestion,
  Rows3,
  ScanSearch,
} from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { cssVars, stagger } from "@/lib/css-vars";
import { HUES, type Hue } from "./hues";

interface Step {
  href: string;
  hue: Hue;
  icon: typeof ScanSearch;
  title: string;
  text: string;
}

const STEPS: readonly Step[] = [
  {
    href: "/features#quality",
    hue: "orange",
    icon: ScanSearch,
    title: "Check",
    text: "A score, empty cells, the type each column holds, duplicates and any personal data, in seconds.",
  },
  {
    href: "/features#clean",
    hue: "yellow",
    icon: Eraser,
    title: "Fix",
    text: "Pick the steps, see what each would change across the whole file, and keep the result as the next version.",
  },
  {
    href: "/features#changes",
    hue: "teal",
    icon: Rows3,
    title: "Compare",
    text: "Every upload is compared with the last: the shape that changed, then which rows.",
  },
  {
    href: "/features#ask",
    hue: "blue",
    icon: MessageCircleQuestion,
    title: "Ask",
    text: "Group and total every row, or type a question. The assistant never sees a row.",
  },
  {
    href: "/features#access",
    hue: "sienna",
    icon: Lock,
    title: "Control",
    text: "Your own rules, access per person, and an audit log nobody can edit.",
  },
];

/** The whole product as one path a file takes, so the home page tells a story and the features page can be the reference. */
export function FlowStrip() {
  return (
    <section id="flow" className="scroll-mt-16 border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <Reveal className="flex flex-col gap-3">
          <h2 className="headline max-w-3xl text-4xl leading-[0.98] sm:text-5xl">
            What happens after you upload.
          </h2>
          <p className="max-w-prose copy text-text-muted">
            One file, five things done for you. Each links to the full
            description.
          </p>
        </Reveal>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                style={{
                  ...stagger(index, 80),
                  ...cssVars({ "--division": `var(${HUES[step.hue].cssVar})` }),
                  borderTopWidth: 5,
                  borderTopColor: "var(--division)",
                }}
                className="stagger-item leaf"
              >
                <Link
                  href={step.href}
                  className="group flex h-full flex-col gap-3 p-5"
                >
                  <span className="flex items-center justify-between text-text-subtle">
                    <span className="font-mono text-sm tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Icon aria-hidden className="size-5 text-text" />
                  </span>
                  <span className="headline text-3xl leading-none">
                    {step.title}
                  </span>
                  <span className="text-base text-text-muted">{step.text}</span>
                  <ArrowRight
                    aria-hidden
                    className="mt-auto size-4 transition-transform duration-(--duration-base) ease-out group-hover:translate-x-1"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
