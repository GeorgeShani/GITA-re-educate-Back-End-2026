import { PageHead } from "@/components/marketing/page-head";
import { BillEstimator } from "@/components/marketing/pricing/bill-estimator";
import { BillingFaq } from "@/components/marketing/pricing/billing-faq";
import { PlanTable } from "@/components/marketing/pricing/plan-table";
import { Reveal } from "@/components/motion/reveal";
import { fetchPlans } from "@/lib/api/plans";

export const metadata = {
  title: "Pricing",
  description:
    "Free, Basic and Premium: what each plan includes, and what a company of your size would pay.",
};

// The catalog is fetched at request time and cached for five minutes, so a price change never needs a deploy.
export const revalidate = 300;

export default async function Page() {
  const plans = await fetchPlans();

  return (
    <>
      <PageHead title={["Priced by seat", "and by volume."]}>
        <p>
          Start free. Pay per employee on Basic, or a flat monthly price with a
          generous file allowance on Premium. Every number on this page is read
          from the same catalog the product enforces.
        </p>
      </PageHead>

      <section className="border-b border-line">
        <div className="mx-auto w-full max-w-6xl px-6 py-14 md:py-20">
          {plans ? (
            <Reveal>
              <PlanTable plans={plans} />
            </Reveal>
          ) : (
            <div className="leaf p-8">
              <h2 className="headline text-3xl leading-none">
                Prices are not loading right now.
              </h2>
              <p className="copy mt-3 max-w-prose text-text-muted">
                The plan catalog could not be reached, and this page will not
                guess at a price. Try again in a minute. The Free plan needs no
                card, so you can start now.
              </p>
            </div>
          )}
        </div>
      </section>

      {plans ? (
        <section className="border-b border-line">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <Reveal className="flex flex-col gap-5">
              <h2 className="headline text-4xl leading-[0.98] sm:text-5xl">
                What would your company pay?
              </h2>
              <p className="copy max-w-prose text-text-muted">
                Move the sliders to your team and your file volume. Nothing here
                is a recommendation: it is the arithmetic of each plan, and it
                tells you when a plan cannot hold your numbers.
              </p>
            </Reveal>
            <Reveal delay={120} className="min-w-0">
              <BillEstimator plans={plans} />
            </Reveal>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 md:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <Reveal>
            <h2 className="headline text-4xl leading-[0.98] sm:text-5xl">
              Billing, answered.
            </h2>
          </Reveal>
          <Reveal delay={120} className="min-w-0">
            <BillingFaq />
          </Reveal>
        </div>
      </section>
    </>
  );
}
