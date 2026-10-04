import { ArrowRight } from "lucide-react";
import { stagger } from "@/lib/css-vars";
import { visibleSpaces } from "@/lib/format/spaces";
import { Panel } from "../exhibit";

const STEPS = [
  ["Trim spaces", "212 cells"],
  ["Remove repeated rows", "38 rows"],
  ["Write dates as YYYY-MM-DD", "1,904 cells"],
  ["Hide the card numbers (last four)", "1 column"],
] as const;

const CELLS = [
  ["joined", "03 Apr 2026", "2026-04-03"],
  ["name", "  Ada  Lovelace ", "Ada Lovelace"],
  ["card_on_file", "4111 1111 1111 1111", "•••• 1111"],
] as const;

/** A cleaning recipe, what each step would change over the whole file, and three cells before and after. Invented sample. */
export function CleanSteps() {
  return (
    <Panel label="customers-export.csv · clean (sample)">
      <ol className="flex flex-col">
        {STEPS.map(([step, changed], index) => (
          <li
            key={step}
            style={stagger(index, 90)}
            className="stagger-item flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm"
          >
            <span>
              <span className="num mr-2 font-mono text-xs text-text-subtle">
                {index + 1}
              </span>
              {step}
            </span>
            <span className="num font-mono text-xs text-text-muted">
              {changed}
            </span>
          </li>
        ))}
      </ol>
      <ul className="flex flex-col gap-2 rounded-md border border-line bg-sunken p-3 font-mono text-xs">
        {CELLS.map(([column, before, after]) => (
          <li key={column} className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-text-subtle">{column}</span>
            <del className="whitespace-pre text-text-subtle">
              {visibleSpaces(before)}
            </del>
            <ArrowRight aria-hidden className="size-3 text-text-subtle" />
            <span className="font-semibold">{after}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-subtle">
        The result is the next version, and your upload is left as it was.
        Sample data, invented for this page.
      </p>
    </Panel>
  );
}
