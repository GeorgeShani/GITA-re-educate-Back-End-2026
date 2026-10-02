"use client";

import { KeyRound, LoaderCircle, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { GoogleMark } from "@/features/auth/form-parts";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import { exactTime, relativeTime } from "@/lib/format/time";

export interface Identity {
  id: string;
  provider: "password" | "google";
  email: string | null;
  lastUsedAt: string | null;
}

const NAME = { password: "Email and password", google: "Google" } as const;

/**
 * Every way this person can sign in. Each can be removed except the last one (the API refuses that too, but offering a
 * button that cannot work helps nobody). Google can be connected from here, which is also how someone who joined with a
 * password adds it afterwards.
 */
export function LinkedAccounts({
  identities,
}: {
  identities: readonly Identity[];
}) {
  const hasGoogle = identities.some(
    (identity) => identity.provider === "google",
  );
  const onlyOne = identities.length <= 1;

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <ul className="leaf divide-y divide-line" aria-label="Ways to sign in">
        {identities.map((identity) => (
          <Row key={identity.id} identity={identity} canRemove={!onlyOne} />
        ))}
      </ul>

      {onlyOne ? (
        <p className="text-sm text-text-muted">
          This is your only way to sign in, so it cannot be removed. Connect
          another first.
        </p>
      ) : null}

      {hasGoogle ? null : (
        <div className="leaf flex flex-col gap-3 p-5">
          <h2 className="text-lg font-semibold">Sign in with Google too</h2>
          <p className="text-text-muted">
            Connect a Google account and you can use it instead of your
            password. Your email and password keep working.
          </p>
          <form action="/session/google-link" method="post">
            <Button type="submit">
              <GoogleMark />
              Connect Google
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function Row({
  identity,
  canRemove,
}: {
  identity: Identity;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setProblem(null);
    const result = await callApi("DELETE", `/auth/identities/${identity.id}`);
    if (succeeded(result)) {
      setConfirming(false);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong text-text-muted"
      >
        <KeyRound className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{NAME[identity.provider]}</p>
        <p className="truncate text-text-muted">
          {identity.email ?? "No address reported"}
        </p>
        <p className="text-sm text-text-subtle">
          {identity.lastUsedAt ? (
            <>
              Last used{" "}
              <time
                dateTime={identity.lastUsedAt}
                title={exactTime(identity.lastUsedAt)}
                suppressHydrationWarning
              >
                {relativeTime(identity.lastUsedAt)}
              </time>
            </>
          ) : (
            "Not used yet"
          )}
        </p>
      </div>
      {canRemove ? (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          <Unlink aria-hidden />
          Remove
          <span className="sr-only"> {NAME[identity.provider]}</span>
        </Button>
      ) : null}

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!busy) setConfirming(open);
        }}
        title={`Remove ${NAME[identity.provider]}?`}
        description="You will no longer be able to sign in this way. Your other ways to sign in keep working, and you can add this one again later."
      >
        <div className="flex flex-col gap-4 p-5">
          {problem ? (
            <p role="alert" className="font-medium text-hold">
              {problem}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? (
                <LoaderCircle aria-hidden className="animate-spin" />
              ) : (
                <Unlink aria-hidden />
              )}
              Remove
            </Button>
          </div>
        </div>
      </Dialog>
    </li>
  );
}
