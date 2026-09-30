import { ArrowRight } from "lucide-react";
import { Stamp } from "@/components/ui/stamp";
import { stagger } from "@/lib/css-vars";
import { Panel } from "../exhibit";
import { Tick } from "./tick";

/** Version 3 against version 4 of one dataset: what a new upload changed, worked out from the two stored reports. */
export function VersionDiff() {
  return (
    <Panel label="inventory-q2.csv · version 3 to version 4 (sample)">
      <div className="flex items-center gap-3 font-mono text-sm">
        <span className="rounded-xs border border-line-strong px-2 py-0.5 text-text-muted">
          v3
        </span>
        <ArrowRight aria-hidden className="size-4 text-text-subtle" />
        <span className="rounded-xs border border-text bg-text px-2 py-0.5 text-canvas">
          v4
        </span>
        <span className="ml-auto text-xs text-text-subtle">
          uploaded just now
        </span>
      </div>

      <ul className="flex flex-col">
        <li
          style={stagger(0, 100)}
          className="stagger-item flex items-center justify-between gap-3 border-b border-line py-3 text-sm"
        >
          <span>Rows</span>
          <span className="num font-mono">
            8,930 <span className="text-text-subtle">→</span>{" "}
            <Tick from={8930} to={9412} />{" "}
            <span className="text-pass">+482</span>
          </span>
        </li>
        <li
          style={stagger(1, 100)}
          className="stagger-item flex items-center justify-between gap-3 border-b border-line py-3 text-sm"
        >
          <span>
            Empty cells in <span className="font-mono">unit_cost</span>
          </span>
          <span className="num font-mono">
            12.8% <span className="text-text-subtle">→</span> 4.1%
          </span>
        </li>
        <li
          style={stagger(2, 100)}
          className="stagger-item flex items-center justify-between gap-3 border-b border-line py-3 text-sm"
        >
          <span>Quality score</span>
          <span className="num font-mono">
            63 <span className="text-text-subtle">→</span>{" "}
            <Tick from={63} to={88} />
          </span>
        </li>
        <li
          style={stagger(3, 100)}
          className="stagger-item flex items-center justify-between gap-3 py-3 text-sm"
        >
          <span>
            Column <span className="font-mono">region</span> removed
          </span>
          <Stamp tone="hold">Schema changed</Stamp>
        </li>
      </ul>
      <p className="text-xs text-text-subtle">
        A removed or retyped column alerts the uploader and your admins. Sample
        data, invented for this page.
      </p>
    </Panel>
  );
}
