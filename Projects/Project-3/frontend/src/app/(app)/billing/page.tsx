import { ChevronRight, Receipt } from "lucide-react";
import Link from "next/link";
import { AdminsOnly } from "@/components/app/admins-only";
import { Pager } from "@/components/app/pager";
import { TickNumber } from "@/components/app/tick-number";
import { PLAN_LABEL } from "@/components/marketing/pricing/plan-copy";
import { CheckoutNotice } from "@/features/billing/checkout-notice";
import { DateRange } from "@/features/billing/date-range";
import { InvoiceStamp } from "@/features/billing/invoice-status";
import { LineItems } from "@/features/billing/line-items";
import { PlanSection } from "@/features/billing/plan-section";
import { PortalButton } from "@/features/billing/portal-button";
import { fetchPlans } from "@/lib/api/plans";
import { formatCents } from "@/lib/format/money";
import { formatDay } from "@/lib/format/time";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Billing" };

const PER_PAGE = 10;

function pageOf(value: string | string[] | undefined): number {
  const one = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(one ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function Page({ searchParams }: PageProps<"/billing">) {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    return <AdminsOnly what="billing" />;
  }
  const query = await searchParams;
  const page = pageOf(query.page);
  const returned = Array.isArray(query.checkout)
    ? query.checkout[0]
    : query.checkout;
  const api = apiClient(session.accessToken);
  const [statement, invoices, plans] = await Promise.all([
    api.GET("/billing/current"),
    api.GET("/billing/invoices", {
      params: { query: { page, limit: PER_PAGE } },
    }),
    fetchPlans(),
  ]);
  const bill = statement.data;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Billing
        </h1>
        <p className="max-w-prose text-text-muted">
          What this period costs so far, the plan you are on, and every invoice
          Gridline has issued.
        </p>
      </header>

      {returned === "success" || returned === "cancelled" ? (
        <CheckoutNotice
          outcome={returned}
          planIsPaid={bill ? bill.plan !== "free" : false}
        />
      ) : null}

      <section aria-labelledby="period-heading" className="flex flex-col gap-4">
        <h2 id="period-heading" className="text-2xl font-semibold">
          This period
        </h2>
        {bill ? (
          <>
            <div className="leaf grid gap-6 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-text-muted">
                  The invoice if nothing changes
                </p>
                <p className="text-5xl font-semibold leading-none sm:text-6xl">
                  <TickNumber value={bill.totalCents} kind="cents" />
                </p>
                <p className="mt-1 text-text-muted">
                  {PLAN_LABEL[bill.plan]} plan ·{" "}
                  <DateRange
                    start={bill.period.start}
                    endExclusive={bill.period.end}
                  />
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm sm:text-right">
                <div>
                  <dt className="text-text-muted">Seats</dt>
                  <dd className="num font-mono text-lg font-semibold">
                    {bill.seats.toLocaleString("en-US")}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Files</dt>
                  <dd className="num font-mono text-lg font-semibold">
                    {bill.filesThisPeriod.toLocaleString("en-US")}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Invoiced</dt>
                  <dd className="num text-lg font-semibold">
                    {formatDay(bill.dueDate)}
                  </dd>
                </div>
              </dl>
            </div>
            <LineItems
              items={bill.lineItems}
              totalCents={bill.totalCents}
              totalLabel="Total if nothing changes"
            />
          </>
        ) : (
          <Unavailable>
            We could not work out this period&apos;s bill just now.
          </Unavailable>
        )}
      </section>

      <section aria-labelledby="plan-heading" className="flex flex-col gap-4">
        <h2 id="plan-heading" className="text-2xl font-semibold">
          Your plan
        </h2>
        {plans && bill ? (
          <PlanSection
            plans={plans}
            current={bill.plan}
            usage={{
              files: bill.filesThisPeriod,
              employees: Math.max(0, bill.seats - 1),
            }}
          />
        ) : (
          <Unavailable>
            We could not load the plans just now. Reload the page in a moment.
          </Unavailable>
        )}
      </section>

      <section
        aria-labelledby="invoices-heading"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="invoices-heading" className="text-2xl font-semibold">
            Invoices
          </h2>
          <PortalButton />
        </div>
        {invoices.data ? (
          invoices.data.data.length === 0 ? (
            <div className="leaf flex flex-col items-center gap-3 px-6 py-12 text-center">
              <Receipt aria-hidden className="size-8 text-text-muted" />
              <p className="headline text-2xl">No invoices yet</p>
              <p className="max-w-md text-text-muted">
                The first one is issued when this period ends, on{" "}
                {bill ? formatDay(bill.dueDate) : "the due date"}.
              </p>
            </div>
          ) : (
            <ul aria-label="Invoices" className="leaf divide-y divide-line">
              {invoices.data.data.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/billing/invoices/${invoice.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-sunken"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        <DateRange
                          start={invoice.periodStart}
                          endExclusive={invoice.periodEnd}
                        />
                      </span>
                      <span className="block text-sm text-text-muted">
                        {PLAN_LABEL[invoice.plan]} plan
                      </span>
                    </span>
                    <InvoiceStamp status={invoice.status} />
                    <span className="num w-24 text-right font-mono font-semibold">
                      {formatCents(invoice.totalCents)}
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
          <Unavailable>
            We could not load your invoices just now. Reload the page in a
            moment.
          </Unavailable>
        )}
        {invoices.data ? (
          <Pager
            label="More invoices"
            page={page}
            totalPages={invoices.data.meta.totalPages}
            href={(next) => (next > 1 ? `/billing?page=${next}` : "/billing")}
          />
        ) : null}
      </section>
    </div>
  );
}

function Unavailable({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
    >
      {children}
    </p>
  );
}
