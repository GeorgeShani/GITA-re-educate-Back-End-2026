"use client";

import { FileSearch, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { subscribeLive } from "@/lib/realtime/live";
import { FileListHeader, FileRowView } from "./file-row";
import { FilterBar } from "./filter-bar";
import { type FileFilters, isFiltered, NO_FILTERS } from "./filters";
import { FILES_QUERY, variablesFor } from "./query";
import { type FilePage, type FileRow, toPage, toStatus } from "./types";
import { UploadZone } from "./upload-zone";

interface Person {
  id: string;
  fullName: string;
}

/**
 * The whole Files screen as one piece of state: the rows on show, the cursor for more, and the two things that change them
 * while the page is open (a finished upload, and a report moving to a new status). The first page is drawn by the server;
 * everything after is fetched here, through this site's own door to the API.
 */
export function FilesView({
  initial,
  filters,
  people,
  uploaderName,
  isAdmin,
}: {
  initial: FilePage;
  filters: FileFilters;
  people: readonly Person[];
  uploaderName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<FileRow[]>(initial.rows);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A report moved on: update the row it belongs to, if it is on screen. A quota change re-reads the frame's meter.
  useEffect(() => {
    return subscribeLive({
      onFileStatus: (event) => {
        const status = toStatus(event.status);
        if (!status) return;
        setRows((current) =>
          current.map((row) =>
            row.id === event.fileId
              ? { ...row, status, score: event.qualityScore }
              : row,
          ),
        );
      },
      onQuota: () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 600);
      },
    });
  }, [router]);

  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setProblem(null);
    try {
      const response = await fetch("/session/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: FILES_QUERY,
          variables: variablesFor(filters, cursor),
        }),
      });
      const page = response.ok ? toPage(await response.json()) : null;
      if (!page) {
        setProblem("We could not load more files. Try again.");
        return;
      }
      setRows((current) => {
        const known = new Set(current.map((row) => row.id));
        return [...current, ...page.rows.filter((row) => !known.has(row.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setProblem("We could not load more files. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const uploaded = (row: FileRow) => {
    setRows((current) =>
      current.some((existing) => existing.id === row.id)
        ? current
        : [row, ...current],
    );
    setFresh((current) => new Set(current).add(row.id));
  };

  const empty = rows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <UploadZone
        uploaderName={uploaderName}
        canManageBilling={isAdmin}
        onUploaded={uploaded}
      />

      <div className="flex flex-col gap-3">
        <FilterBar filters={filters} people={isAdmin ? people : []} />

        {empty ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-line bg-surface px-4 py-14 text-center">
            <FileSearch aria-hidden className="size-7 text-text-muted" />
            {isFiltered(filters) ? (
              <>
                <p className="font-semibold">No files match these filters</p>
                <Button
                  onClick={() => {
                    router.replace("/files");
                  }}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="font-semibold">No files yet</p>
                <p className="max-w-sm text-sm text-text-muted">
                  Drop a spreadsheet above. Gridline checks it the moment it
                  arrives and shows you what it found.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-line bg-surface">
            <FileListHeader />
            <ul aria-label="Files">
              {rows.map((row) => (
                <FileRowView key={row.id} row={row} fresh={fresh.has(row.id)} />
              ))}
            </ul>
          </div>
        )}

        {problem ? (
          <p role="alert" className="text-sm font-medium text-hold">
            {problem}
          </p>
        ) : null}
        {cursor ? (
          <div className="flex justify-center">
            <Button onClick={loadMore} disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle aria-hidden className="animate-spin" />
                  Loading…
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        ) : null}
        {!empty && !cursor ? (
          <p className="text-center text-sm text-text-subtle">
            That is every file you can see
            {isFiltered(filters) ? " with these filters" : ""}.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { NO_FILTERS };
