"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A page of the dashboard failed to load: say so plainly, and offer the one thing that might help. */
export default function AppError({
  error,
  reset,
}: {
  error: { message: string; digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
      <h1 className="headline text-4xl leading-[0.98]">
        That page did not load
      </h1>
      <p className="text-text-muted">
        Gridline may be busy for a moment, or something went wrong on our side:
        nothing you did, and you are still signed in. Try again; if it keeps
        happening, quote the reference below to support.
      </p>
      {error.digest ? (
        <p className="num font-mono text-sm text-text-subtle">
          Reference {error.digest}
        </p>
      ) : null}
      <Button variant="primary" onClick={reset}>
        <RotateCcw aria-hidden />
        Try again
      </Button>
    </div>
  );
}
