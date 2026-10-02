"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { subscribeLive } from "@/lib/realtime/live";

/**
 * Draws nothing. While this file's report is still being built, listens for it to move and asks the server to draw the
 * page again, so the numbers appear the moment they exist without anyone reloading.
 */
export function LiveRefresh({ fileId }: { fileId: string }) {
  const router = useRouter();
  useEffect(
    () =>
      subscribeLive({
        onFileStatus: (event) => {
          if (event.fileId === fileId) router.refresh();
        },
      }),
    [fileId, router],
  );
  return null;
}
