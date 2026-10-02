import type { components } from "@/lib/api/schema";

export type WebhookEvent =
  components["schemas"]["CreateWebhookEndpointDto"]["events"][number];

export const EVENTS: readonly {
  id: WebhookEvent;
  label: string;
  description: string;
}[] = [
  {
    id: "file.uploaded",
    label: "A file is uploaded",
    description: "A new file or a new version has arrived.",
  },
  {
    id: "report.ready",
    label: "A report is ready",
    description: "A file's data-quality report finished.",
  },
  {
    id: "report.failed",
    label: "A report could not be made",
    description: "The file could not be read, or profiling failed.",
  },
  {
    id: "rules.failed",
    label: "A quality rule failed",
    description: "A file broke one of your data-quality rules.",
  },
  {
    id: "quota.threshold",
    label: "The file quota is nearly used",
    description: "The company crossed 80% or 100% of its files this period.",
  },
  {
    id: "invoice.finalized",
    label: "An invoice is issued",
    description: "A billing period closed and its invoice was created.",
  },
];

export function eventLabel(id: string): string {
  return EVENTS.find((event) => event.id === id)?.label ?? id;
}
