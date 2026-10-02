import { ChevronRight, Webhook } from "lucide-react";
import Link from "next/link";
import { AdminsOnly } from "@/components/app/admins-only";
import { Pager } from "@/components/app/pager";
import { PLAN_LABEL } from "@/components/marketing/pricing/plan-copy";
import { CreateEndpointButton } from "@/features/webhooks/endpoint-form";
import { eventLabel } from "@/features/webhooks/events";
import { EndpointStamp } from "@/features/webhooks/status";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";
import { getSubscription } from "@/lib/session/subscription";

export const metadata = { title: "Webhooks" };

const PER_PAGE = 20;

/** How many endpoints may be active at once, by plan. `null` is no cap. The API enforces it; this only explains it. */
const ACTIVE_CAP = { free: 1, basic: 5, premium: null } as const;

function pageOf(value: string | string[] | undefined): number {
  const one = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(one ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function Page({
  searchParams,
}: PageProps<"/developers/webhooks">) {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    return <AdminsOnly what="webhooks" />;
  }
  const page = pageOf((await searchParams).page);
  const api = apiClient(session.accessToken);
  const [endpoints, subscription] = await Promise.all([
    api.GET("/outgoing-webhooks", {
      params: { query: { page, limit: PER_PAGE } },
    }),
    getSubscription(session.accessToken),
  ]);

  const plan = subscription.data?.plan;
  const cap = plan ? ACTIVE_CAP[plan] : null;
  const active =
    endpoints.data?.data.filter(
      (endpoint) => endpoint.active && endpoint.disabledAt === null,
    ).length ?? 0;
  const full = cap !== null && active >= cap;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Webhooks
        </h1>
        <p className="max-w-prose text-text-muted">
          Tell your own systems when something happens in Gridline. Each
          delivery is signed, retried when it fails, and kept for 30 days.{" "}
          <Link
            href="/docs/webhooks"
            className="font-semibold text-text underline underline-offset-2"
          >
            How to verify a delivery
          </Link>
          .
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-muted">
          {plan && cap !== null
            ? `${PLAN_LABEL[plan]} allows ${cap} active ${cap === 1 ? "endpoint" : "endpoints"}.`
            : plan
              ? `${PLAN_LABEL[plan]} has no limit on endpoints.`
              : null}
        </p>
        <CreateEndpointButton disabled={full} />
      </div>

      {full ? (
        <p
          role="note"
          className="rounded-md border border-caution bg-caution-soft p-3 text-caution"
        >
          Your plan&apos;s endpoints are all in use.{" "}
          <Link
            href="/billing"
            className="font-semibold underline underline-offset-2"
          >
            See the plans
          </Link>{" "}
          for more, or pause one to add another.
        </p>
      ) : null}

      {endpoints.data ? (
        endpoints.data.data.length === 0 ? (
          <div className="leaf flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Webhook aria-hidden className="size-8 text-text-muted" />
            <p className="headline text-2xl">No endpoints yet</p>
            <p className="max-w-md text-text-muted">
              Add the address of your receiver and choose the events it should
              hear about.
            </p>
          </div>
        ) : (
          <ul aria-label="Endpoints" className="leaf divide-y divide-line">
            {endpoints.data.data.map((endpoint) => (
              <li key={endpoint.id}>
                <Link
                  href={`/developers/webhooks/${endpoint.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 hover:bg-sunken"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold [overflow-wrap:anywhere]">
                        {endpoint.name}
                      </span>
                      <EndpointStamp endpoint={endpoint} />
                    </span>
                    <span className="truncate font-mono text-sm text-text-muted">
                      {endpoint.url}
                    </span>
                    <span className="text-sm text-text-subtle">
                      {endpoint.events.map(eventLabel).join(" · ")}
                    </span>
                    {endpoint.consecutiveFailures > 0 &&
                    endpoint.disabledAt === null ? (
                      <span className="text-sm font-medium text-caution">
                        Failed {endpoint.consecutiveFailures} in a row
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 text-text-subtle"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load your endpoints just now. Reload the page in a
          moment.
        </p>
      )}

      {endpoints.data ? (
        <Pager
          label="More endpoints"
          page={page}
          totalPages={endpoints.data.meta.totalPages}
          href={(next) =>
            next > 1
              ? `/developers/webhooks?page=${next}`
              : "/developers/webhooks"
          }
        />
      ) : null}
    </div>
  );
}
