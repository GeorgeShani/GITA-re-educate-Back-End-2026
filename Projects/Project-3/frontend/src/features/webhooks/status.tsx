import { Stamp } from "@/components/ui/stamp";
import type { components } from "@/lib/api/schema";

type Endpoint = components["schemas"]["WebhookEndpointDto"];
type Delivery = components["schemas"]["WebhookDeliveryDto"];

/** Active, paused by a person, or switched off by Gridline after repeated failures: three states, three words. */
export function EndpointStamp({
  endpoint,
}: {
  endpoint: Pick<Endpoint, "active" | "disabledAt">;
}) {
  if (endpoint.disabledAt !== null)
    return <Stamp tone="hold">Switched off</Stamp>;
  if (!endpoint.active) return <Stamp tone="idle">Paused</Stamp>;
  return <Stamp tone="pass">Active</Stamp>;
}

const DELIVERY: Record<
  Delivery["status"],
  { tone: "pass" | "hold" | "idle"; label: string }
> = {
  succeeded: { tone: "pass", label: "Delivered" },
  failed: { tone: "hold", label: "Failed" },
  pending: { tone: "idle", label: "Queued" },
};

export function DeliveryStamp({ status }: { status: Delivery["status"] }) {
  const { tone, label } = DELIVERY[status];
  return <Stamp tone={tone}>{label}</Stamp>;
}
