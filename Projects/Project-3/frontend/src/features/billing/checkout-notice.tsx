"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const CHECK_EVERY_MS = 3000;
const GIVE_UP_AFTER_MS = 60_000;

/**
 * What to say when Stripe sends someone back to Billing. Paying is confirmed to the API by Stripe a moment after the person
 * returns, so for a few seconds the plan may still read Free: say that the payment is being applied, and keep asking until
 * the plan changes, instead of leaving them to wonder whether it worked.
 */
export function CheckoutNotice({
  outcome,
  planIsPaid,
}: {
  outcome: "success" | "cancelled";
  planIsPaid: boolean;
}) {
  const router = useRouter();
  const waiting = outcome === "success" && !planIsPaid;
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_AFTER_MS) {
        setGaveUp(true);
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [waiting, router]);

  if (outcome === "cancelled") {
    return (
      <output className="block rounded-md border border-line-strong bg-sunken p-3 font-medium">
        Checkout was cancelled and you were not charged. Your plan is unchanged.
      </output>
    );
  }
  if (!waiting) {
    return (
      <output className="block rounded-md border border-pass bg-pass-soft p-3 font-medium text-pass">
        Payment received. Your plan is active.
      </output>
    );
  }
  return (
    <output className="flex items-center gap-2 rounded-md border border-caution bg-caution-soft p-3 font-medium text-caution">
      {gaveUp ? null : (
        <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" />
      )}
      {gaveUp
        ? "Your payment went through, but the confirmation has not reached us yet. Do not pay again: reload in a minute, and contact support if the plan still has not changed."
        : "Payment received. Your plan is being activated: this takes a few seconds."}
    </output>
  );
}
