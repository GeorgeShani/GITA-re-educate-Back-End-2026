import { Stamp } from "@/components/ui/stamp";
import { stagger } from "@/lib/css-vars";
import { Panel } from "../exhibit";

const COLUMNS = [
  {
    name: "email",
    kind: "Email addresses",
    share: "98% of cells",
    found: true,
  },
  { name: "mobile", kind: "Phone numbers", share: "91% of cells", found: true },
  {
    name: "card_on_file",
    kind: "Card numbers",
    share: "Luhn check passes",
    found: true,
  },
  { name: "plan", kind: "Nothing personal", share: "", found: false },
] as const;

/** What the scan says about a file: which columns look like personal or secret data, by shape and checksum. Invented sample. */
export function PersonalData() {
  return (
    <Panel label="customers-export.csv · personal data (sample)">
      <ul className="flex flex-col">
        {COLUMNS.map((column, index) => (
          <li
            key={column.name}
            style={stagger(index, 90)}
            className="stagger-item flex items-center justify-between gap-3 border-b border-line py-3 text-sm"
          >
            <span className="min-w-0">
              <span className="block font-mono">{column.name}</span>
              <span className="text-xs text-text-subtle">
                {column.found
                  ? `${column.kind} · ${column.share}`
                  : column.kind}
              </span>
            </span>
            {column.found ? (
              <Stamp tone="hold">Personal data</Stamp>
            ) : (
              <Stamp tone="pass">Clear</Stamp>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-text-muted">
        Visible to the whole company. The uploader and your admins are told.
      </p>
      <p className="text-xs text-text-subtle">
        Found by patterns and checksums, never by an AI, and never shown as a
        value. Sample data, invented for this page.
      </p>
    </Panel>
  );
}
