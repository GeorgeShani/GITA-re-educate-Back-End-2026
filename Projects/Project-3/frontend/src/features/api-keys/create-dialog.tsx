"use client";

import { KeyRound, LoaderCircle, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyButton } from "@/components/marketing/exhibits/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded, textOf } from "@/lib/api/call";
import { cn } from "@/lib/cn";
import { SCOPES, type Scope } from "./scopes";

interface Created {
  name: string;
  key: string;
  scopes: Scope[];
}

/** "Create a key": a button, and the dialog that names it, scopes it, and then shows the secret exactly once. */
export function CreateKeyButton({
  isAdmin,
  disabled,
}: {
  isAdmin: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <KeyRound aria-hidden />
        Create a key
      </Button>
      {/* Mounted only while open, so each key starts from an empty form and a forgotten secret cannot linger. */}
      {open ? (
        <CreateDialog isAdmin={isAdmin} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function CreateDialog({
  isAdmin,
  onClose,
}: {
  isAdmin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<readonly Scope[]>(["files:read"]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const toggle = (scope: Scope) => {
    setProblem(null);
    setChosen((now) =>
      now.includes(scope) ? now.filter((s) => s !== scope) : [...now, scope],
    );
  };

  const create = async () => {
    const label = name.trim();
    if (label === "") {
      setProblem("Name the key, so you can tell your keys apart later.");
      return;
    }
    if (chosen.length === 0) {
      setProblem("Choose at least one thing the key may do.");
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await callApi("POST", "/api-keys", {
      name: label,
      scopes: chosen,
    });
    const key = succeeded(result) ? textOf(result.body, "key") : null;
    if (key) {
      setCreated({ name: label, key, scopes: [...chosen] });
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  if (created) {
    return (
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title="Your key"
        description="This is the only time the whole key is shown."
      >
        <div className="flex flex-col gap-4 p-5">
          <p
            role="note"
            className="flex gap-2 rounded-md border border-caution bg-caution-soft p-3 text-caution"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Copy it now and keep it somewhere safe. Gridline stores only a
              fingerprint, so it cannot show it again. If you lose it, revoke it
              and make another.
            </span>
          </p>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{created.name}</p>
            <div className="flex items-center gap-2 rounded-md border border-line-strong bg-sunken p-2">
              <code
                data-testid="new-key"
                className="min-w-0 flex-1 font-mono text-sm [overflow-wrap:anywhere]"
              >
                {created.key}
              </code>
              <CopyButton text={created.key} label="Copy the key" />
            </div>
          </div>
          <p className="text-sm text-text-muted">
            Send it as{" "}
            <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>
            . A key acts as you, and can never do more than you can.
          </p>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onClose}>
              I have stored it
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      title="Create a key"
      description="A key lets a script or an agent work as you, with only the permissions you give it."
    >
      <form
        className="flex flex-col gap-5 p-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <Field label="Name" hint="What it is for: “Nightly import”.">
          {(control) => (
            <Input
              {...control}
              value={name}
              maxLength={80}
              autoComplete="off"
              autoFocus
              onChange={(event) => {
                setProblem(null);
                setName(event.target.value);
              }}
            />
          )}
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">What it may do</legend>
          {SCOPES.map((scope) => {
            const locked = scope.adminOnly && !isAdmin;
            const checked = chosen.includes(scope.id);
            return (
              <label
                key={scope.id}
                className={cn(
                  "flex gap-3 rounded-md border p-3",
                  checked ? "border-text bg-sunken" : "border-line",
                  locked ? "opacity-60" : "cursor-pointer hover:bg-sunken",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked || busy}
                  onChange={() => toggle(scope.id)}
                  className="mt-1 size-4 accent-[var(--color-text)]"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">
                    {scope.label}
                    {scope.adminOnly ? (
                      <span className="ml-2 text-xs font-semibold uppercase tracking-[0.06em] text-text-subtle">
                        Admins
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm text-text-muted">
                    {locked
                      ? "Only an admin can give a key this."
                      : scope.description}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {problem ? (
          <p role="alert" className="font-medium text-hold">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : null}
            Create key
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
