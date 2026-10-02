"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";

/** Deleting asks first, and says what it does and does not undo. */
export function DeleteButton({
  fileId,
  name,
  version,
}: {
  fileId: string;
  name: string;
  version: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("DELETE", `/files/${fileId}`);
    if (succeeded(result)) {
      router.push("/files");
      router.refresh();
      return;
    }
    setProblem(messageFor(result));
    setBusy(false);
  };

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Delete
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title={`Delete version ${version}?`}
        description={`“${name}” will disappear from your files and its stored copy will be removed. Other versions are not touched, and it still counts toward this period's upload allowance.`}
      >
        <div className="flex flex-col gap-4 p-5">
          {problem ? (
            <p role="alert" className="font-medium text-hold">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <Trash2 aria-hidden />
              )}
              Delete version
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
