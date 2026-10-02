import { FileSpreadsheet, FileText, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format/bytes";
import { exactTime, relativeTime } from "@/lib/format/time";
import { ReportStamp } from "./report-stamp";
import { type FileRow, typeLabel } from "./types";

/**
 * One file. On a wide screen a row of columns; on a phone the same facts stacked. The whole row is the link (the name's
 * link is stretched over it), so there is one big target and one tab stop per file.
 */
export function FileRowView({ row, fresh }: { row: FileRow; fresh?: boolean }) {
  const type = typeLabel(row.mimeType);
  const Icon = type === "CSV" ? FileText : FileSpreadsheet;
  return (
    <li
      className={cn(
        "relative grid gap-x-4 gap-y-1.5 border-b border-line px-4 py-3 transition-colors duration-(--duration-fast) last:border-b-0 hover:bg-sunken",
        "md:grid-cols-[minmax(0,1fr)_7rem_6rem_9rem_8rem] md:items-center",
        fresh && "conveyor",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon aria-hidden className="size-5 shrink-0 text-text-muted" />
        <div className="min-w-0">
          <Link
            href={`/files/${row.id}`}
            className="block truncate font-semibold after:absolute after:inset-0 after:content-['']"
          >
            {row.name}
          </Link>
          <p className="flex items-center gap-1.5 text-sm text-text-muted">
            <span className="num font-mono text-xs">{type}</span>
            <span aria-hidden>·</span>
            <span>
              {row.isLatest ? "Version" : "Older version"}{" "}
              <span className="num font-mono">{row.version}</span>
            </span>
            {row.visibility === "restricted" ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>·</span>
                <Lock aria-hidden className="size-3" />
                Restricted
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-8 md:contents">
        <div className="flex items-center">
          <ReportStamp status={row.status} score={row.score} />
        </div>
        <p className="num font-mono text-sm text-text-muted">
          {formatBytes(row.sizeBytes)}
        </p>
        <p className="truncate text-sm text-text-muted">{row.uploaderName}</p>
        <p className="text-sm text-text-muted">
          <time
            dateTime={row.createdAt}
            title={exactTime(row.createdAt)}
            suppressHydrationWarning
          >
            {relativeTime(row.createdAt)}
          </time>
        </p>
      </div>
    </li>
  );
}

/** The column titles above the rows. Hidden on a phone, where each row carries its own labels in plain words. */
export function FileListHeader() {
  return (
    <div
      aria-hidden
      className="hidden grid-cols-[minmax(0,1fr)_7rem_6rem_9rem_8rem] gap-x-4 border-b border-line-strong px-4 py-2 text-xs font-semibold tracking-[0.06em] text-text-subtle uppercase md:grid"
    >
      <span>File</span>
      <span>Report</span>
      <span>Size</span>
      <span>Uploaded by</span>
      <span>When</span>
    </div>
  );
}
