"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const RETRY_EVERY_MS = 6000;

/**
 * Shown instead of the whole dashboard when Gridline cannot be asked who you are right now: it is busy (a small plan allows
 * only so many requests a minute), restarting, or unreachable. Nobody is signed out; the page tries again by itself.
 */
export function Busy() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), RETRY_EVERY_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="headline text-4xl leading-[0.98]">
        Gridline is busy for a moment
      </h1>
      <p className="text-text-muted">
        You are still signed in. This page will try again by itself in a few
        seconds, or you can try now.
      </p>
      <Button variant="primary" onClick={() => router.refresh()}>
        <RotateCcw aria-hidden />
        Try again
      </Button>
    </div>
  );
}
