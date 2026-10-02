import { Stamp } from "@/components/ui/stamp";
import type { components } from "@/lib/api/schema";

export type InvoiceStatus = components["schemas"]["InvoiceDto"]["status"];

const STATUS: Record<
  InvoiceStatus,
  { tone: "pass" | "hold" | "caution" | "idle"; label: string }
> = {
  paid: { tone: "pass", label: "Paid" },
  open: { tone: "caution", label: "Due" },
  uncollectible: { tone: "hold", label: "Unpaid" },
  finalized: { tone: "idle", label: "Issued" },
  draft: { tone: "idle", label: "Draft" },
  void: { tone: "idle", label: "Void" },
};

/** An invoice's state as a stamp: the word is always there, so colour is never the only signal. */
export function InvoiceStamp({ status }: { status: InvoiceStatus }) {
  const { tone, label } = STATUS[status];
  return <Stamp tone={tone}>{label}</Stamp>;
}
