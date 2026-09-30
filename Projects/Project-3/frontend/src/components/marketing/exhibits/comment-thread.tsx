import { Bell } from "lucide-react";
import { stagger } from "@/lib/css-vars";
import { Panel } from "../exhibit";

/** A thread on a file: a mention, a reply, who is looking right now, and the notification the mention sends. */
export function CommentThread() {
  return (
    <Panel label="Comments on inventory-q2.csv (sample)">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span
          aria-hidden
          className="size-2 rounded-full bg-pass motion-safe:animate-[gl-live_1.4s_ease-in-out_infinite]"
        />
        Sam and Priya are looking at this file now
      </div>

      <ol className="flex flex-col gap-4">
        <li
          style={stagger(0, 120)}
          className="stagger-item flex flex-col gap-1 border-b border-line pb-4"
        >
          <p className="text-sm font-semibold">
            Priya <span className="font-normal text-text-subtle">· 14:12</span>
          </p>
          <p className="text-sm">
            <span className="rounded-xs bg-tag-soft px-1 font-medium">
              @Sam
            </span>{" "}
            unit_cost is empty for 12.8% of rows. Can you check the supplier
            export?
          </p>
        </li>
        <li
          style={stagger(1, 120)}
          className="stagger-item flex flex-col gap-1 pl-5"
        >
          <p className="text-sm font-semibold">
            Sam <span className="font-normal text-text-subtle">· 14:19</span>
          </p>
          <p className="text-sm">
            Found it: one supplier sent no prices. Uploading a corrected
            version.
          </p>
        </li>
      </ol>

      <div
        style={stagger(2, 120)}
        className="stagger-item flex items-center gap-2 rounded-sm border border-line bg-sunken px-3 py-2 text-xs text-text-muted"
      >
        <Bell aria-hidden className="size-3.5 shrink-0" />
        Sam was told about the mention the moment it was posted. Nobody who
        cannot see the file can be mentioned.
      </div>
    </Panel>
  );
}
