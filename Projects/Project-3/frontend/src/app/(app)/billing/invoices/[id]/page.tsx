import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminsOnly } from "@/components/app/admins-only";
import { PLAN_LABEL } from "@/components/marketing/pricing/plan-copy";
import { Button } from "@/components/ui/button";
import { DateRange } from "@/features/billing/date-range";
import { InvoiceStamp } from "@/features/billing/invoice-status";
import { LineItems } from "@/features/billing/line-items";
import { exactTime, formatDay } from "@/lib/format/time";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Invoice" };

/** The API types these two as an open object; at runtime each is an address or nothing. */
function addressOf(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("https://")
    ? value
    : null;
}

export default async function Page({
  params,
}: PageProps<"/billing/invoices/[id]">) {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    return <AdminsOnly what="billing" />;
  }
  const { id } = await params;
  const { data: invoice, response } = await apiClient(session.accessToken).GET(
    "/billing/invoices/{id}",
    { params: { path: { id } } },
  );
  if (response.status === 404 || response.status === 400) notFound();

  const hosted = invoice ? addressOf(invoice.stripeHostedInvoiceUrl) : null;
  const pdf = invoice ? addressOf(invoice.stripeInvoicePdfUrl) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href="/billing"
        className="inline-flex w-fit items-center gap-1.5 text-text-muted hover:text-text"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Billing
      </Link>

      {invoice ? (
        <>
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
                Invoice
              </h1>
              <InvoiceStamp status={invoice.status} />
            </div>
            <p className="text-text-muted">
              {PLAN_LABEL[invoice.plan]} plan ·{" "}
              <DateRange
                start={invoice.periodStart}
                endExclusive={invoice.periodEnd}
              />
            </p>
          </header>

          <dl className="leaf grid gap-4 p-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-text-muted">Issued</dt>
              <dd className="font-medium">{formatDay(invoice.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-muted">Due</dt>
              <dd className="font-medium">{formatDay(invoice.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-muted">Paid</dt>
              <dd className="font-medium">
                {invoice.paidAt ? exactTime(invoice.paidAt) : "Not yet"}
              </dd>
            </div>
          </dl>

          <LineItems
            items={invoice.lineItems}
            totalCents={invoice.totalCents}
            totalLabel="Total"
          />

          {invoice.paymentAttempts > 0 && invoice.status !== "paid" ? (
            <p
              role="note"
              className="rounded-md border border-caution bg-caution-soft p-3 text-caution"
            >
              Payment has been tried{" "}
              <span className="num font-mono">{invoice.paymentAttempts}</span>{" "}
              {invoice.paymentAttempts === 1 ? "time" : "times"}. Update the
              card under Payment details on the Billing page and Stripe tries
              again.
            </p>
          ) : null}

          {hosted || pdf ? (
            <div className="flex flex-wrap gap-2">
              {hosted ? (
                <Button asChild variant="primary">
                  <a href={hosted} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden />
                    View on Stripe
                  </a>
                </Button>
              ) : null}
              {pdf ? (
                <Button asChild>
                  <a href={pdf} target="_blank" rel="noopener noreferrer">
                    Download PDF
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load this invoice just now. Reload the page in a moment.
        </p>
      )}
    </div>
  );
}
