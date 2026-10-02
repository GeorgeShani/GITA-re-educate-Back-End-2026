"use client";

import { Check, CircleAlert, FileUp, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { inputStyles } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format/bytes";
import { type FileRow, toVisibility, type Visibility } from "./types";
import { messageFor, problemWith, rowFromUpload, sendFile } from "./upload";

type State = "waiting" | "sending" | "done" | "refused";

interface Item {
  id: string;
  name: string;
  size: number;
  state: State;
  /** 0 to 1 while sending. */
  progress: number;
  message?: string;
}

/** How many files go up at once: enough to be quick, few enough that each still shows honest progress. */
const AT_ONCE = 2;

/**
 * Drop files here, or choose them. Each goes up on its own with its own progress and its own answer, so one refusal (a quota,
 * a file that is not a spreadsheet) never stops the rest. A finished file appears in the list at once, and its report fills in
 * live. The API decides what a file really is from its bytes; the checks here only spare a long upload that is sure to fail.
 */
export function UploadZone({
  uploaderName,
  canManageBilling,
  onUploaded,
}: {
  uploaderName: string;
  canManageBilling: boolean;
  onUploaded: (row: FileRow) => void;
}) {
  const inputId = useId();
  const [items, setItems] = useState<Item[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("company");
  const [dragging, setDragging] = useState(false);
  const files = useRef(new Map<string, File>());
  const running = useRef(0);
  const queue = useRef<string[]>([]);

  const patch = (id: string, change: Partial<Item>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );

  const pump = () => {
    while (running.current < AT_ONCE) {
      const id = queue.current.shift();
      if (!id) return;
      const file = files.current.get(id);
      if (!file) continue;
      running.current += 1;
      patch(id, { state: "sending", progress: 0 });
      void sendFile(file, visibility, crypto.randomUUID(), (share) =>
        patch(id, { progress: share }),
      ).then((result) => {
        running.current -= 1;
        files.current.delete(id);
        const row =
          result.status === 201
            ? rowFromUpload(result.body, uploaderName)
            : null;
        if (row) {
          patch(id, { state: "done", progress: 1 });
          onUploaded(row);
        } else {
          patch(id, { state: "refused", message: messageFor(result) });
        }
        pump();
      });
    }
  };

  const add = (picked: FileList | File[]) => {
    const added: Item[] = [];
    for (const file of Array.from(picked)) {
      const id = crypto.randomUUID();
      const problem = problemWith(file);
      added.push({
        id,
        name: file.name,
        size: file.size,
        state: problem ? "refused" : "waiting",
        progress: 0,
        ...(problem ? { message: problem } : {}),
      });
      if (!problem) {
        files.current.set(id, file);
        queue.current.push(id);
      }
    }
    setItems((current) => [...added, ...current].slice(0, 12));
    pump();
  };

  const active = items.some(
    (item) => item.state === "waiting" || item.state === "sending",
  );

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-label="Drop files to upload"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-line-strong bg-surface px-4 py-6 text-center transition-colors duration-(--duration-fast)",
          dragging && "border-text bg-tag-soft",
        )}
      >
        <FileUp aria-hidden className="size-6 text-text-muted" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Drop spreadsheets here</p>
          <p className="text-sm text-text-muted">
            CSV, XLS or XLSX, up to 25 MB each. Each one is checked as soon as
            it arrives.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" asChild>
            <label htmlFor={inputId} className="cursor-pointer">
              Choose files
            </label>
          </Button>
          <input
            id={inputId}
            type="file"
            multiple
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              if (event.target.files) add(event.target.files);
              event.target.value = "";
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Who can see them</span>
            <select
              className={cn(inputStyles(), "h-8 w-auto pr-7 text-sm")}
              value={visibility}
              onChange={(event) =>
                setVisibility(toVisibility(event.target.value) ?? "company")
              }
            >
              <option value="company">Whole company</option>
              <option value="restricted">Only me and admins</option>
            </select>
          </label>
        </div>
      </section>

      {items.length > 0 ? (
        <ul
          aria-label="Uploads"
          aria-live="polite"
          className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface"
        >
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-3 py-2.5">
              <span className="mt-0.5 shrink-0">
                {item.state === "done" ? (
                  <Check
                    aria-hidden
                    className="size-4 text-pass"
                    strokeWidth={2.5}
                  />
                ) : item.state === "refused" ? (
                  <CircleAlert aria-hidden className="size-4 text-hold" />
                ) : (
                  <LoaderCircle
                    aria-hidden
                    className="size-4 animate-spin text-text-muted"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{item.name}</span>
                  <span className="num shrink-0 font-mono text-xs text-text-muted">
                    {formatBytes(item.size)}
                  </span>
                </p>
                {item.state === "sending" ? (
                  <div
                    role="progressbar"
                    aria-label={`Uploading ${item.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress * 100)}
                    className="mt-1.5 h-1 overflow-hidden rounded-full bg-sunken"
                  >
                    <div
                      className="h-full rounded-full bg-text transition-[width] duration-(--duration-fast)"
                      style={{ width: `${item.progress * 100}%` }}
                    />
                  </div>
                ) : null}
                {item.state === "waiting" ? (
                  <p className="text-sm text-text-muted">Waiting</p>
                ) : null}
                {item.state === "done" ? (
                  <p className="text-sm text-pass">
                    Uploaded. Its report is being built.
                  </p>
                ) : null}
                {item.state === "refused" ? (
                  <p className="text-sm font-medium text-hold">
                    {item.message}
                    {canManageBilling &&
                    /plan|quota/i.test(item.message ?? "") ? (
                      <>
                        {" "}
                        <Link
                          href="/billing"
                          className="underline underline-offset-2"
                        >
                          Open billing
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              {item.state === "refused" || item.state === "done" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Dismiss ${item.name}`}
                  onClick={() =>
                    setItems((current) =>
                      current.filter((other) => other.id !== item.id),
                    )
                  }
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {active ? <output className="sr-only">Uploading</output> : null}
    </div>
  );
}
