"use client";

import { CreditCard, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded, textOf } from "@/lib/api/call";

/**
 * Opens Stripe's customer portal, where the card on file and the invoices are managed. The address is made on demand and
 * is single-use, so it is asked for at the click, never rendered into the page.
 */
export function PortalButton() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("POST", "/billing/portal-session");
    const url = succeeded(result) ? textOf(result.body, "url") : null;
    if (url) {
      window.location.assign(url);
      return;
    }
    setProblem(messageFor(result));
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button disabled={busy} onClick={() => void open()}>
        {busy ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <CreditCard aria-hidden />
        )}
        Payment details
      </Button>
      {problem ? (
        <p role="alert" className="text-sm font-medium text-hold">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
