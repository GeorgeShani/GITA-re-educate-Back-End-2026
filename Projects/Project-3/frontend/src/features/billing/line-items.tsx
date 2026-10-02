import type { components } from "@/lib/api/schema";
import { formatCents } from "@/lib/format/money";

type LineItem = components["schemas"]["LineItemDto"];

/** What a line is made of, in words: "12 of 31 days", "7 files over the quota". */
function detail(item: LineItem): string {
  if (item.kind === "seat" && item.activeDays !== undefined) {
    return `${item.activeDays} of ${item.periodDays ?? item.activeDays} days`;
  }
  if (item.kind === "plan_base" && item.billedDays !== undefined) {
    return `${item.billedDays} of ${item.periodDays ?? item.billedDays} days`;
  }
  if (item.kind === "overage" && item.files !== undefined) {
    return `${item.files.toLocaleString("en-US")} files over the quota`;
  }
  return "";
}

/** The lines of a statement or an invoice, with the total under them. Money is shown from integer cents, never summed here. */
export function LineItems({
  items,
  totalCents,
  totalLabel,
}: {
  items: LineItem[];
  totalCents: number;
  totalLabel: string;
}) {
  return (
    <div className="leaf overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left">
        <caption className="sr-only">What this bill is made of</caption>
        <thead>
          <tr className="border-b border-line bg-sunken text-sm text-text-muted">
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Item
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Basis
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-4 text-text-muted">
                Nothing is charged for this period.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={`${item.kind}-${item.userId ?? index}`}>
                <td className="px-4 py-3 font-medium">{item.description}</td>
                <td className="px-4 py-3 text-text-muted">{detail(item)}</td>
                <td className="num px-4 py-3 text-right font-mono">
                  {formatCents(item.amountCents)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-text">
            <th scope="row" colSpan={2} className="px-4 py-3 font-semibold">
              {totalLabel}
            </th>
            <td className="num px-4 py-3 text-right font-mono text-lg font-semibold">
              {formatCents(totalCents)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
