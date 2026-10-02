import Link from "next/link";
import { NotificationList } from "@/features/notifications/notification-list";
import { cn } from "@/lib/cn";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Notifications" };

const PER_PAGE = 30;

export default async function Page({
  searchParams,
}: PageProps<"/notifications">) {
  const session = await requireSession();
  const query = await searchParams;
  const unreadOnly = query.unread === "1";
  const api = apiClient(session.accessToken);

  const [page, members] = await Promise.all([
    api.GET("/notifications", {
      params: {
        query: { limit: PER_PAGE, ...(unreadOnly ? { unread: true } : {}) },
      },
    }),
    api.GET("/companies/me/members"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Notifications
        </h1>
        <p className="max-w-prose text-text-muted">
          What has happened that you would want to know about: reports, shared
          files, mentions and your plan.
        </p>
      </header>

      <nav
        aria-label="Which notifications"
        className="-mb-2 flex border-b border-line"
      >
        {[
          { href: "/notifications", label: "All", on: !unreadOnly },
          { href: "/notifications?unread=1", label: "Unread", on: unreadOnly },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            replace
            aria-current={tab.on ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 font-semibold transition-colors duration-(--duration-fast)",
              tab.on
                ? "border-text text-text"
                : "border-transparent text-text-muted hover:border-line-strong hover:text-text",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {page.data ? (
        <NotificationList
          // A different filter is a different list: start it fresh.
          key={unreadOnly ? "unread" : "all"}
          initial={{
            items: page.data.data.map((entry) => ({
              id: entry.id,
              type: entry.type,
              payload: entry.payload,
              readAt: entry.readAt,
              createdAt: entry.createdAt,
            })),
            nextCursor: page.data.meta.hasMore
              ? page.data.meta.nextCursor
              : null,
          }}
          people={members.data ?? []}
          unreadOnly={unreadOnly}
          canWrite={!session.company.isDemo}
        />
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load your notifications just now. Reload the page in a
          moment.
        </p>
      )}
    </div>
  );
}
