"use client";

import { Layers, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";

/**
 * A workbook can have several sheets and a report covers one. This says which, and lets the uploader (or an admin) check
 * another: the choice is kept for later checks of this file. Without it a person could believe the whole workbook was looked at.
 */
export function SheetPicker({
  fileId,
  current,
  others,
  canManage,
}: {
  fileId: string;
  current: string;
  others: readonly string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const choose = async (sheet: string) => {
    setBusy(sheet);
    setProblem(null);
    const result = await callApi("POST", `/files/${fileId}/report/rebuild`, {
      sheet,
    });
    if (succeeded(result)) router.refresh();
    else setProblem(messageFor(result));
    setBusy(null);
  };

  return (
    <div
      role="note"
      className="flex flex-col gap-2 rounded-md border border-line-strong bg-sunken p-3 text-sm"
    >
      <p className="flex flex-wrap items-center gap-2">
        <Layers aria-hidden className="size-4 shrink-0" />
        <span>
          This workbook has {others.length + 1} sheets. This report covers{" "}
          <strong>{current}</strong>; the others are stored but not checked.
        </span>
      </p>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-muted">Check instead:</span>
          {others.map((name) => (
            <Button
              key={name}
              size="sm"
              disabled={busy !== null}
              onClick={() => void choose(name)}
            >
              {busy === name ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : null}
              {name}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-text-muted">
          The person who uploaded it, or an admin, can check another sheet.
        </p>
      )}
      {problem ? (
        <p role="alert" className="font-medium text-hold">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
