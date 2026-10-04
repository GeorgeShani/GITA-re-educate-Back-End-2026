import Link from "next/link";
import { cn } from "@/lib/cn";

export const TABS = [
  { id: "report", label: "Report" },
  { id: "preview", label: "Preview" },
  { id: "explore", label: "Explore" },
  { id: "versions", label: "Versions" },
  { id: "comments", label: "Comments" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function toTab(value: unknown): TabId {
  return TABS.find((tab) => tab.id === value)?.id ?? "report";
}

/**
 * The sections of a file. Each one is a link to the same page with `?tab=`, so a tab can be bookmarked or shared and the
 * server only fetches what the open tab shows.
 */
export function DetailTabs({
  fileId,
  current,
}: {
  fileId: string;
  current: TabId;
}) {
  return (
    <nav
      aria-label="Sections of this file"
      className="-mb-px flex overflow-x-auto scrollbar-none"
    >
      {TABS.map((tab) => {
        const selected = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={
              tab.id === "report"
                ? `/files/${fileId}`
                : `/files/${fileId}?tab=${tab.id}`
            }
            replace
            scroll={false}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 font-semibold transition-colors duration-(--duration-fast)",
              selected
                ? "border-text text-text"
                : "border-transparent text-text-muted hover:border-line-strong hover:text-text",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
