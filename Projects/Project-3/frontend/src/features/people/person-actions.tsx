"use client";

import { LoaderCircle, RotateCcw, Send, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";

type Status = "invited" | "active" | "disabled";

/**
 * What an admin can do about one person, by where they stand: re-send a pending invitation, remove someone who is in,
 * bring back someone who was removed. Admins themselves have none (the API refuses to remove one), so this is not
 * drawn for them.
 */
export function PersonActions({
  id,
  name,
  status,
}: {
  id: string;
  name: string;
  status: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (
    method: "POST" | "DELETE",
    path: string,
    after: () => void,
  ) => {
    setBusy(true);
    setProblem(null);
    const result = await callApi(method, path);
    if (succeeded(result)) {
      after();
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex flex-wrap items-center gap-1">
        {status === "invited" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              void run("POST", `/employees/${id}/resend-invite`, () =>
                setSent(true),
              )
            }
          >
            {busy ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <Send aria-hidden />
            )}
            {sent ? "Sent again" : "Resend invitation"}
            <span className="sr-only"> to {name}</span>
          </Button>
        ) : null}
        {status === "active" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <UserMinus aria-hidden />
            Remove
            <span className="sr-only"> {name}</span>
          </Button>
        ) : null}
        {status === "invited" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <UserMinus aria-hidden />
            Cancel invitation
            <span className="sr-only"> for {name}</span>
          </Button>
        ) : null}
        {status === "disabled" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              void run("POST", `/employees/${id}/reactivate`, () => {})
            }
          >
            {busy ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <RotateCcw aria-hidden />
            )}
            Reactivate
            <span className="sr-only"> {name}</span>
          </Button>
        ) : null}
      </div>
      {problem ? (
        <p role="alert" className="max-w-xs text-sm font-medium text-hold">
          {problem}
        </p>
      ) : null}

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!busy) setConfirming(open);
        }}
        title={
          status === "invited" ? "Cancel this invitation?" : `Remove ${name}?`
        }
        description={
          status === "invited"
            ? `The link ${name} was sent will stop working and the seat is freed. You can invite them again, or reactivate them.`
            : `${name} will not be able to sign in, their seat is freed, and their API keys stop working. What they uploaded stays with the company. You can bring them back later.`
        }
      >
        <div className="flex flex-col gap-4 p-5">
          {problem ? (
            <p role="alert" className="font-medium text-hold">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => setConfirming(false)} disabled={busy}>
              Keep them
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run("DELETE", `/employees/${id}`, () =>
                  setConfirming(false),
                )
              }
            >
              {busy ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <UserMinus aria-hidden />
              )}
              {status === "invited" ? "Cancel invitation" : "Remove"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
