import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminsOnly } from "@/components/app/admins-only";
import { Pager } from "@/components/app/pager";
import {
  EndpointActions,
  RedeliverButton,
} from "@/features/webhooks/endpoint-actions";
import { EditEndpointForm } from "@/features/webhooks/endpoint-form";
import { eventLabel } from "@/features/webhooks/events";
import { DeliveryStamp, EndpointStamp } from "@/features/webhooks/status";
import { exactTime, relativeTime } from "@/lib/format/time";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Webhook endpoint" };

const PER_PAGE = 15;

function pageOf(value: string | string[] | undefined): number {
  const one = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(one ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/developers/webhooks/[id]">) {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    return <AdminsOnly what="webhooks" />;
  }
  const { id } = await params;
  const page = pageOf((await searchParams).page);
  const api = apiClient(session.accessToken);

  // There is no "get one" route: an endpoint is found among the company's own, which is also what keeps it tenant-safe.
  const [list, deliveries] = await Promise.all([
    api.GET("/outgoing-webhooks", {
      params: { query: { page: 1, limit: 100 } },
    }),
    api.GET("/outgoing-webhooks/{id}/deliveries", {
      params: { path: { id }, query: { page, limit: PER_PAGE } },
    }),
  ]);
  if (list.data && !list.data.data.some((endpoint) => endpoint.id === id)) {
    notFound();
  }
  const endpoint = list.data?.data.find((entry) => entry.id === id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
      <Link
        href="/developers/webhooks"
        className="inline-flex w-fit items-center gap-1.5 text-text-muted hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Webhooks
      </Link>

      {endpoint ? (
        <>
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="headline text-4xl leading-[0.98] [overflow-wrap:anywhere] sm:text-5xl">
                {endpoint.name}
              </h1>
              <EndpointStamp endpoint={endpoint} />
            </div>
            <p className="font-mono text-sm text-text-muted [overflow-wrap:anywhere]">
              {endpoint.url}
            </p>
            {endpoint.disabledAt !== null ? (
              <p
                role="note"
                className="rounded-md border border-hold bg-hold-soft p-3 text-hold"
              >
                Gridline switched this endpoint off on{" "}
                <time dateTime={endpoint.disabledAt}>
                  {exactTime(endpoint.disabledAt)}
                </time>{" "}
                because deliveries kept failing, or your receiver answered that
                it was gone. Fix the receiver, then turn it back on.
              </p>
            ) : endpoint.consecutiveFailures > 0 ? (
              <p
                role="note"
                className="rounded-md border border-caution bg-caution-soft p-3 text-caution"
              >
                The last {endpoint.consecutiveFailures} deliveries failed.
                Gridline switches an endpoint off after twenty in a row.
              </p>
            ) : null}
          </header>

          <section
            aria-labelledby="actions-heading"
            className="flex flex-col gap-3"
          >
            <h2 id="actions-heading" className="text-2xl font-semibold">
              Actions
            </h2>
            <EndpointActions
              id={endpoint.id}
              name={endpoint.name}
              active={endpoint.active}
              disabled={endpoint.disabledAt !== null}
            />
          </section>

          <section
            aria-labelledby="settings-heading"
            className="flex flex-col gap-3"
          >
            <h2 id="settings-heading" className="text-2xl font-semibold">
              Settings
            </h2>
            <EditEndpointForm
              id={endpoint.id}
              initial={{
                name: endpoint.name,
                url: endpoint.url,
                events: endpoint.events,
              }}
            />
          </section>
        </>
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load this endpoint just now. Reload the page in a moment.
        </p>
      )}

      <section
        aria-labelledby="deliveries-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="deliveries-heading" className="text-2xl font-semibold">
          Deliveries
        </h2>
        {deliveries.data ? (
          deliveries.data.data.length === 0 ? (
            <p className="leaf p-5 text-text-muted">
              Nothing has been sent to this endpoint yet. Use Send a test to see
              one arrive.
            </p>
          ) : (
            <ul aria-label="Deliveries" className="leaf divide-y divide-line">
              {deliveries.data.data.map((delivery) => (
                <li
                  key={delivery.id}
                  className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3.5"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <DeliveryStamp status={delivery.status} />
                      <span className="font-semibold">
                        {delivery.eventType === "ping"
                          ? "Test"
                          : eventLabel(delivery.eventType)}
                      </span>
                      {delivery.responseStatus !== null ? (
                        <span className="num font-mono text-sm text-text-muted">
                          {delivery.responseStatus}
                        </span>
                      ) : null}
                    </p>
                    {delivery.lastError ? (
                      <p className="text-sm text-hold [overflow-wrap:anywhere]">
                        {delivery.lastError}
                      </p>
                    ) : null}
                    <p className="text-sm text-text-subtle">
                      <time
                        dateTime={delivery.createdAt}
                        title={exactTime(delivery.createdAt)}
                        suppressHydrationWarning
                      >
                        {relativeTime(delivery.createdAt)}
                      </time>
                      {" · "}
                      {delivery.attempts}{" "}
                      {delivery.attempts === 1 ? "attempt" : "attempts"}
                    </p>
                  </div>
                  {delivery.status === "failed" ? (
                    <RedeliverButton deliveryId={delivery.id} />
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : (
          <p
            role="alert"
            className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
          >
            We could not load the deliveries just now. Reload the page in a
            moment.
          </p>
        )}
        {deliveries.data ? (
          <Pager
            label="More deliveries"
            page={page}
            totalPages={deliveries.data.meta.totalPages}
            href={(next) =>
              next > 1
                ? `/developers/webhooks/${id}?page=${next}`
                : `/developers/webhooks/${id}`
            }
          />
        ) : null}
      </section>
    </div>
  );
}
