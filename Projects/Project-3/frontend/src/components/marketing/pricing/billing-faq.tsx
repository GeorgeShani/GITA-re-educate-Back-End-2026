"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

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
    "Does a cleaned version use my file allowance?",
    "No. A cleaned version is made by Gridline, not uploaded by you, so it does not count towards the files a billing period allows. It does count towards the number of versions of one file your plan keeps. An upload that is cleaned automatically counts once, as the upload.",
  ],
  [
    "What is a question to the assistant?",
    "Each plain-language question the assistant answers about a file counts: 20 a billing period on Free, 300 on Basic and 3,000 on Premium. The query builder is not counted, and neither is a question the assistant could not answer.",
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
        <Question key={question} question={question} answer={answer} />
      ))}
    </div>
  );
}

/**
 * One question. The answer lives in a grid row that animates between 0fr and 1fr, so it opens and closes smoothly at
 * whatever height its text needs, in every browser. A closed answer is inert: it cannot be tabbed into or read out.
 */
function Question({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-4 py-5 text-left text-md font-semibold"
        >
          {question}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 transition-transform duration-(--duration-slow) ease-(--ease-out)",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      <section
        id={id}
        aria-label={question}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-(--duration-slow) ease-(--ease-out)",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <p className="copy max-w-prose pb-6 text-text-muted">{answer}</p>
        </div>
      </section>
    </div>
  );
}
