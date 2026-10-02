"use client";

import {
  AtSign,
  Bell,
  BellOff,
  CircleAlert,
  CircleCheck,
  Columns3,
  CreditCard,
  Gauge,
  ListChecks,
  LoaderCircle,
  type LucideIcon,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import { cn } from "@/lib/cn";
import { exactTime, relativeTime } from "@/lib/format/time";
import { adjustUnread, setUnread } from "@/lib/notifications/unread";
import { subscribeLive } from "@/lib/realtime/live";
import { describe, type Glyph } from "./describe";
import {
  type NotificationItem,
  type NotificationPage,
  toItem,
  toPage,
} from "./types";

const GLYPHS: Record<Glyph, LucideIcon> = {
  check: CircleCheck,
  alert: CircleAlert,
  rules: ListChecks,
  columns: Columns3,
  share: Share2,
  mention: AtSign,
  quota: Gauge,
  invoice: CreditCard,
  other: Bell,
};

/**
 * The inbox. The server draws the first page; what changes while it is open is held here: new entries arriving live,
 * entries being read, and later pages. Reading an entry (opening it, or the button) lowers the bell in the top bar too.
 */
export function NotificationList({
  initial,
  people,
  unreadOnly,
  canWrite,
}: {
  initial: NotificationPage;
  /** Colleagues by id, so "someone shared a file with you" can say who. */
  people: readonly { id: string; fullName: string }[];
  unreadOnly: boolean;
  /** False in the read-only demo, where marking as read is refused. */
  canWrite: boolean;
}) {
  const [items, setItems] = useState<NotificationItem[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const names = new Map(people.map((person) => [person.id, person.fullName]));
  const unread = items.filter((item) => item.readAt === null).length;

  // A new one arrives: put it on top, and let the bell count it (the frame does that on its own).
  useEffect(() => {
    return subscribeLive({
      onNotification: (event) => {
        const item = toItem({ ...event, readAt: null });
        if (!item) return;
        setItems((current) =>
          current.some((existing) => existing.id === item.id)
            ? current
            : [item, ...current],
        );
      },
    });
  }, []);

  const markRead = async (item: NotificationItem) => {
    if (item.readAt !== null || !canWrite) return;
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, readAt: new Date().toISOString() }
          : entry,
      ),
    );
    adjustUnread(-1);
    const result = await callApi("POST", `/notifications/${item.id}/read`);
    if (!succeeded(result)) {
      // It did not save: put it back as it was, and say so.
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: null } : entry,
        ),
      );
      adjustUnread(1);
      setProblem(messageFor(result));
    }
  };

  const markAll = async () => {
    setProblem(null);
    const result = await callApi("POST", "/notifications/read-all");
    if (!succeeded(result)) {
      setProblem(messageFor(result));
      return;
    }
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((entry) =>
        entry.readAt === null ? { ...entry, readAt: now } : entry,
      ),
    );
    setUnread(0);
  };

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setProblem(null);
    const query = new URLSearchParams({ cursor, limit: "30" });
    if (unreadOnly) query.set("unread", "true");
    const result = await callApi("GET", `/notifications?${query.toString()}`);
    const page = succeeded(result) ? toPage(result.body) : null;
    if (!page) {
      setProblem("We could not load more. Try again.");
    } else {
      setItems((current) => {
        const known = new Set(current.map((entry) => entry.id));
        return [
          ...current,
          ...page.items.filter((entry) => !known.has(entry.id)),
        ];
      });
      setCursor(page.nextCursor);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {canWrite && unread > 0 ? (
        <div className="flex justify-end">
          <Button onClick={markAll}>
            <CircleCheck aria-hidden />
            Mark all as read
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="leaf flex flex-col items-center gap-3 px-6 py-14 text-center">
          <BellOff aria-hidden className="size-8 text-text-muted" />
          <p className="headline text-2xl">
            {unreadOnly ? "You are all caught up" : "Nothing yet"}
          </p>
          <p className="max-w-md text-text-muted">
            {unreadOnly
              ? "There is nothing you have not read."
              : "When a report is ready, a file is shared with you or someone mentions you, it shows up here."}
          </p>
        </div>
      ) : (
        <ul aria-label="Notifications" className="leaf divide-y divide-line">
          {items.map((item) => (
            <Entry
              key={item.id}
              item={item}
              names={names}
              canWrite={canWrite}
              onRead={() => void markRead(item)}
            />
          ))}
        </ul>
      )}

      {problem ? (
        <p role="alert" className="font-medium text-hold">
          {problem}
        </p>
      ) : null}
      {cursor ? (
        <div className="flex justify-center">
          <Button onClick={loadMore} disabled={loading}>
            {loading ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Entry({
  item,
  names,
  canWrite,
  onRead,
}: {
  item: NotificationItem;
  names: ReadonlyMap<string, string>;
  canWrite: boolean;
  onRead: () => void;
}) {
  const said = describe(item, names);
  const Icon = GLYPHS[said.glyph];
  const isUnread = item.readAt === null;

  const body = (
    <>
      <span className={cn("block font-semibold", !isUnread && "font-medium")}>
        {said.title}
      </span>
      {said.detail ? (
        <span className="block text-text-muted [overflow-wrap:anywhere]">
          {said.detail}
        </span>
      ) : null}
    </>
  );

  return (
    <li
      className={cn(
        "relative flex items-start gap-3 px-4 py-3.5 transition-colors duration-(--duration-fast)",
        isUnread ? "bg-surface" : "bg-sunken/50",
        said.href && "hover:bg-sunken",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
          isUnread
            ? "border-text bg-tag text-on-tag"
            : "border-line-strong text-text-muted",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        {said.href ? (
          <Link
            href={said.href}
            onClick={onRead}
            className="block after:absolute after:inset-0 after:content-['']"
          >
            {body}
          </Link>
        ) : (
          <div>{body}</div>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-text-subtle">
          <time
            dateTime={item.createdAt}
            title={exactTime(item.createdAt)}
            suppressHydrationWarning
          >
            {relativeTime(item.createdAt)}
          </time>
          {isUnread ? (
            <span className="font-semibold text-text">New</span>
          ) : null}
        </p>
      </div>
      {isUnread && canWrite ? (
        <Button
          variant="ghost"
          size="sm"
          className="relative z-10 shrink-0"
          onClick={onRead}
        >
          Mark as read
        </Button>
      ) : null}
    </li>
  );
}
