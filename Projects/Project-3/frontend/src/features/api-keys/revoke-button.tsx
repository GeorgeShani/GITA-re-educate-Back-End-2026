"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";

/** Revokes one key, after asking: anything still using it stops working at once, and a revoked key cannot come back. */
export function RevokeButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const revoke = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("DELETE", `/api-keys/${id}`);
    if (succeeded(result)) {
      setConfirming(false);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden />
        Revoke
        <span className="sr-only"> {name}</span>
      </Button>
      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirming(false);
        }}
        title="Revoke this key?"
        description={`Anything using “${name}” stops working straight away. This cannot be undone: make a new key instead.`}
      >
        <div className="flex flex-col gap-4 p-5">
          {problem ? (
            <p role="alert" className="font-medium text-hold">
              {problem}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button disabled={busy} onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void revoke()}
            >
              {busy ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <Trash2 aria-hidden />
              )}
              Revoke key
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
