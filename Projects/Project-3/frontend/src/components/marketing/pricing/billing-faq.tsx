import { ChevronDown } from "lucide-react";

const QUESTIONS = [
  [
    "When does a billing period start?",
    "On the day you activate a plan. If that is the 31st, short months use their last day and the next month goes back to the 31st.",
  ],
  [
    "What if I change plan in the middle of a period?",
    "The old plan is billed for the days it ran, and the new plan starts that day. Seats are counted by the days each employee was active, so an employee who joins mid-period is billed for the rest of it.",
  ],
  [
    "Who takes the payment?",
    "Stripe. Paid plans start through Stripe Checkout and are managed in Stripe's customer portal. Gridline never stores card numbers.",
  ],
  [
    "What happens at the file quota?",
    "On Free and Basic, an upload past the quota is refused with a message that names the plan, the count and the date the quota resets. On Premium it is accepted and billed at the per-file rate.",
  ],
  [
    "Can I move to a smaller plan?",
    "Yes, once the company fits the smaller plan. If it has more employees, rules or file versions than the plan allows, Gridline tells you exactly which numbers must come down first.",
  ],
  [
    "What if a payment fails?",
    "The billing address gets an email and there is a grace period to fix the card. After the grace period the company is suspended: admins can still sign in to update billing, and paying reactivates it.",
  ],
] as const;

/** Billing questions, answered in the terms the billing engine actually uses. */
export function BillingFaq() {
  return (
    <div className="flex flex-col border-t border-line-strong">
      {QUESTIONS.map(([question, answer]) => (
        <details key={question} className="group border-b border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-md font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
            <h3>{question}</h3>
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 transition-transform duration-(--duration-base) group-open:rotate-180"
            />
          </summary>
          <p className="copy max-w-prose pb-6 text-text-muted">{answer}</p>
        </details>
      ))}
    </div>
  );
}
