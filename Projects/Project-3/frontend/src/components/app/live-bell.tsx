"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { adjustUnread, setUnread, useUnread } from "@/lib/notifications/unread";
import { subscribeLive } from "@/lib/realtime/live";

/**
 * The bell in the top bar. The server draws the count it knew; from then on a notification arriving over the live
 * connection raises it, and reading one (on the Notifications page) lowers it, with no reload. A change in how much of
 * the plan is used asks the server to draw the frame again, so the meter in the rail moves too.
 */
export function LiveBell({ initial }: { initial: number }) {
  const router = useRouter();
  const unread = useUnread(initial);
  const refresh = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The server drew a fresh number (a navigation or a refresh): start from it.
  useEffect(() => {
    setUnread(initial);
  }, [initial]);

  useEffect(() => {
    return subscribeLive({
      onNotification: () => adjustUnread(1),
      onQuota: () => {
        if (refresh.current) clearTimeout(refresh.current);
        refresh.current = setTimeout(() => router.refresh(), 600);
      },
    });
  }, [router]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      asChild
      aria-label={
        unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
      }
    >
      <Link href="/notifications">
        <Bell aria-hidden />
        {unread > 0 ? (
          <span
            aria-hidden
            className="num absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-text bg-tag px-1 font-mono text-[0.625rem] font-bold text-on-tag"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
