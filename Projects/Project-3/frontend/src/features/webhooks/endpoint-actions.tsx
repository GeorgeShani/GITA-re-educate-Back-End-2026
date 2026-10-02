"use client";

import {
  KeyRound,
  LoaderCircle,
  Pause,
  Play,
  RotateCw,
  Send,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded, textOf } from "@/lib/api/call";
import { SecretReveal } from "./secret-reveal";

type Confirming = "rotate" | "delete" | null;

/**
 * What an admin can do with one endpoint: send a test, pause or resume it, replace its secret, remove it. The two that
 * cannot be taken back (a new secret stops the old one at once; removing deletes the history) ask first.
 */
export function EndpointActions({
  id,
  name,
  active,
  disabled,
}: {
  id: string;
  name: string;
  active: boolean;
  /** Switched off by Gridline after repeated failures, rather than paused by a person. */
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const run = async (
    what: string,
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    body: unknown,
    after: (responseBody: unknown) => void,
  ) => {
    setBusy(what);
    setProblem(null);
    setNote(null);
    const result = await callApi(method, path, body);
    if (succeeded(result)) {
      after(result.body);
    } else {
      setProblem(messageFor(result));
      setConfirming(null);
    }
    setBusy(null);
  };

  const base = `/outgoing-webhooks/${id}`;
  const working = busy !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={working}
          onClick={() =>
            void run("ping", "POST", `${base}/ping`, undefined, () => {
              setNote("A test is on its way. It appears under Deliveries.");
              router.refresh();
            })
          }
        >
          {busy === "ping" ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : (
            <Send aria-hidden />
          )}
          Send a test
        </Button>
        <Button
          disabled={working}
          onClick={() =>
            void run("toggle", "PATCH", base, { active: !active }, () => {
              router.refresh();
            })
          }
        >
          {busy === "toggle" ? (
            <LoaderCircle aria-hidden className="animate-spin" />
          ) : active ? (
            <Pause aria-hidden />
          ) : (
            <Play aria-hidden />
          )}
          {active ? "Pause" : disabled ? "Turn back on" : "Resume"}
        </Button>
        <Button disabled={working} onClick={() => setConfirming("rotate")}>
          <KeyRound aria-hidden />
          Replace the secret
        </Button>
        <Button
          variant="danger"
          disabled={working}
          onClick={() => setConfirming("delete")}
        >
          <Trash2 aria-hidden />
          Remove
        </Button>
      </div>
      {note ? (
        <output className="block font-medium text-pass">{note}</output>
      ) : null}
      {problem ? (
        <p role="alert" className="font-medium text-hold">
          {problem}
        </p>
      ) : null}

      <Dialog
        open={confirming === "rotate"}
        onOpenChange={(open) => {
          if (!open && !working) setConfirming(null);
        }}
        title="Replace the secret?"
        description="The old secret stops signing at once, so your receiver will reject deliveries until it has the new one."
      >
        <div className="flex justify-end gap-2 p-5">
          <Button disabled={working} onClick={() => setConfirming(null)}>
            Keep the old one
          </Button>
          <Button
            variant="primary"
            disabled={working}
            onClick={() =>
              void run(
                "rotate",
                "POST",
                `${base}/rotate-secret`,
                undefined,
                (body) => {
                  setConfirming(null);
                  setSecret(textOf(body, "secret"));
                },
              )
            }
          >
            {busy === "rotate" ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <RotateCw aria-hidden />
            )}
            Replace it
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={confirming === "delete"}
        onOpenChange={(open) => {
          if (!open && !working) setConfirming(null);
        }}
        title="Remove this endpoint?"
        description={`“${name}” stops receiving events and its delivery history is deleted. This cannot be undone.`}
      >
        <div className="flex justify-end gap-2 p-5">
          <Button disabled={working} onClick={() => setConfirming(null)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            disabled={working}
            onClick={() =>
              void run("delete", "DELETE", base, undefined, () => {
                router.push("/developers/webhooks");
                router.refresh();
              })
            }
          >
            {busy === "delete" ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <Trash2 aria-hidden />
            )}
            Remove endpoint
          </Button>
        </div>
      </Dialog>

      {secret ? (
        <SecretReveal
          title="New secret"
          secret={secret}
          onClose={() => setSecret(null)}
        />
      ) : null}
    </div>
  );
}

/** Sends one failed delivery again, by hand. The retry itself goes through the same signed, durable path as the first try. */
export function RedeliverButton({ deliveryId }: { deliveryId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setProblem(null);
          const result = await callApi(
            "POST",
            `/outgoing-webhooks/deliveries/${deliveryId}/redeliver`,
          );
          if (succeeded(result)) router.refresh();
          else setProblem(messageFor(result));
          setBusy(false);
        }}
      >
        {busy ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <RotateCw aria-hidden />
        )}
        Send again
      </Button>
      {problem ? (
        <p role="alert" className="text-sm font-medium text-hold">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
