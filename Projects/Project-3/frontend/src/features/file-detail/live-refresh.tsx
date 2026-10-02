"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { subscribeLive } from "@/lib/realtime/live";

/** A report in one of these has stopped changing; "queued" and "profiling" are only on the way. */
const FINAL = new Set(["ready", "failed", "unsupported"]);

/**
 * Draws nothing. While this file's report is still being built, listens for it to finish and asks the server to draw the
 * page again, so the numbers appear the moment they exist without anyone reloading. It waits for the END: drawing the
 * page again costs several API calls (every call counts against the company's requests per minute), so doing it for each
 * step on the way would spend most of a small plan's budget on one report.
 */
export function LiveRefresh({ fileId }: { fileId: string }) {
  const router = useRouter();
  useEffect(
    () =>
      subscribeLive({
        onFileStatus: (event) => {
          if (event.fileId === fileId && FINAL.has(event.status)) {
            router.refresh();
          }
        },
      }),
    [fileId, router],
  );
  return null;
}
