import { ArrowLeft, ArrowRight, GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format/bytes";
import { exactTime, relativeTime } from "@/lib/format/time";

type FileDto = components["schemas"]["FileDto"];
type Meta = components["schemas"]["OffsetMetaDto"];

/** Where "compare" should point: the older version is always the "from" side, so a change reads forward in time. */
function comparePath(current: FileDto, other: FileDto): string {
  return other.version > current.version
    ? `/files/${current.id}/compare/${other.id}`
    : `/files/${other.id}/compare/${current.id}`;
}

/** Every version of this file, newest first, each with a way to open it and to see what changed against the one on screen. */
export function VersionsPanel({
  current,
  versions,
  meta,
  nameOf,
}: {
  current: FileDto;
  versions: readonly FileDto[];
  meta: Meta;
  nameOf: (userId: string) => string;
}) {
  const here = (page: number) =>
    `/files/${current.id}?tab=versions&page=${page}`;
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-text-muted">
        Each upload of this file is kept as its own version. Compare two to see
        what changed: columns added or removed, empty cells, and the quality
        score.
      </p>
      <ul className="leaf divide-y divide-line">
        {versions.map((version) => {
          const isHere = version.id === current.id;
          return (
            <li
              key={version.id}
              className={cn(
                "grid items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]",
                isHere && "bg-sunken",
              )}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/files/${version.id}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    Version{" "}
                    <span className="num font-mono">{version.version}</span>
                  </Link>
                  {version.isLatest ? <Stamp tone="pass">Latest</Stamp> : null}
                  {isHere ? <Stamp tone="idle">You are here</Stamp> : null}
                </p>
                <p className="text-sm text-text-muted">
                  <span className="num font-mono">
                    {formatBytes(version.sizeBytes)}
                  </span>
                  {" · "}
                  {nameOf(version.uploaderId)}
                  {" · "}
                  <time
                    dateTime={version.createdAt}
                    title={exactTime(version.createdAt)}
                  >
                    {relativeTime(version.createdAt)}
                  </time>
                </p>
              </div>
              {isHere ? null : (
                <Button asChild size="sm">
                  <Link href={comparePath(current, version)}>
                    <GitCompareArrows aria-hidden />
                    Compare with version {current.version}
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {meta.totalPages > 1 ? (
        <nav
          aria-label="More versions"
          className="flex items-center justify-between gap-3"
        >
          <Button asChild size="sm" aria-disabled={meta.page <= 1}>
            <Link
              href={here(Math.max(1, meta.page - 1))}
              aria-label="Newer versions"
            >
              <ArrowLeft aria-hidden />
              Newer
            </Link>
          </Button>
          <p className="text-sm text-text-muted">
            Page <span className="num font-mono">{meta.page}</span> of{" "}
            <span className="num font-mono">{meta.totalPages}</span>
          </p>
          <Button
            asChild
            size="sm"
            aria-disabled={meta.page >= meta.totalPages}
          >
            <Link
              href={here(Math.min(meta.totalPages, meta.page + 1))}
              aria-label="Older versions"
            >
              Older
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
