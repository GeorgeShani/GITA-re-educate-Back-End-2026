import { Lock } from "lucide-react";
import { stagger } from "@/lib/css-vars";
import { Panel } from "../exhibit";

const ENTRIES = [
  {
    time: "14:02",
    who: "Priya",
    action: "file.uploaded",
    target: "payroll-march.csv",
  },
  {
    time: "14:03",
    who: "Priya",
    action: "file.access_changed",
    target: "payroll-march.csv",
  },
  {
    time: "14:20",
    who: "Sam",
    action: "quality_rule.updated",
    target: "unit_cost limit",
  },
  {
    time: "15:41",
    who: "Priya",
    action: "api_key.created",
    target: "finance-export",
  },
  {
    time: "16:05",
    who: "Priya",
    action: "employee.invited",
    target: "new person",
  },
] as const;

/** A short stretch of a company's audit log. Sample entries; the real ones are written in the same transaction as the change. */
export function AuditLog() {
  return (
    <Panel label="Audit log · today (sample)">
      <ol className="flex flex-col">
        {ENTRIES.map((entry, index) => (
          <li
            key={`${entry.time}-${entry.action}`}
            style={stagger(index, 80)}
            className="stagger-item grid grid-cols-[3rem_1fr] gap-x-3 border-b border-line py-2.5 text-sm last:border-b-0"
          >
            <span className="num font-mono text-xs text-text-subtle">
              {entry.time}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-mono text-xs">
                {entry.action}
              </span>
              <span className="text-text-muted">
                {entry.who} · {entry.target}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2 text-xs text-text-subtle">
        <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        The database rejects any update or delete of this table. There is no way
        to edit the past.
      </p>
    </Panel>
  );
}
