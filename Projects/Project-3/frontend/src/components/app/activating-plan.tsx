"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const CHECK_EVERY_MS = 3000;
const GIVE_UP_AFTER_MS = 60_000;

/**
 * Where someone lands after paying at Stripe, until Gridline has heard about it. The plan is only created when Stripe's
 * confirmation reaches the API, a moment after the person is sent back, so for a short while the company still has no plan.
 * Showing the plan picker again would invite them to pay twice. This asks again every few seconds, and says what to do if
 * the confirmation never arrives.
 */
export function ActivatingPlan() {
  const router = useRouter();
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_AFTER_MS) {
        setWaitedTooLong(true);
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="headline text-4xl leading-[0.98]">
        {waitedTooLong
          ? "Still waiting for the confirmation"
          : "Payment received"}
      </h1>
      {waitedTooLong ? (
        <>
          <p className="text-text-muted">
            Your payment went through, but the confirmation from our payment
            provider has not arrived yet. It usually does within a minute. Check
            again below. Do not pay a second time: if the plan does not appear,
            contact support and it will be sorted out.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="primary" onClick={() => router.refresh()}>
              <RotateCcw aria-hidden />
              Check again
            </Button>
          </div>
        </>
      ) : (
        <output className="flex items-center gap-2 text-text-muted">
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          Activating your plan. This takes a few seconds.
        </output>
      )}
    </div>
  );
}
