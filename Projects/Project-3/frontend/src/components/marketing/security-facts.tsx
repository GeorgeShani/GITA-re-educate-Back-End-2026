import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { stagger } from "@/lib/css-vars";

const FACTS = [
  [
    "Other companies never see yours",
    "Every query is scoped to your company. Another company’s data is not forbidden; it is simply not found.",
  ],
  [
    "Files stay private",
    "Files sit in a private bucket and are handed out through links that expire after five minutes.",
  ],
  [
    "The record cannot be edited",
    "Every change is written to an audit log that the database itself refuses to alter or delete.",
  ],
  [
    "The assistant never sees your rows",
    "A summary or a question is answered from column names and statistics. Personal data is found by patterns and checksums, and Gridline runs every query itself.",
  ],
  [
    "Secrets are never stored as typed",
    "Passwords and API keys are stored hashed, and webhook secrets are stored encrypted.",
  ],
] as const;

export function SecurityFacts() {
  return (
    <section className="border-t border-line bg-sunken">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <Reveal className="flex flex-col gap-3">
          <h2 className="headline max-w-3xl text-4xl leading-[0.98] sm:text-5xl">
            What happens to your files.
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {FACTS.map(([term, text], index) => (
              <div
                key={term}
                style={stagger(index, 90)}
                className="stagger-item flex flex-col gap-1.5 border-t border-line-strong pt-4"
              >
                <dt className="text-md font-semibold">{term}</dt>
                <dd className="copy text-text-muted">{text}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/security"
            className="link-draw mt-8 inline-block text-base font-medium"
          >
            How it is built
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
