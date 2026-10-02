"use client";

import { LoaderCircle, MailPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invites a colleague: their name, and the address the invitation (and later their sign-in) goes to. */
export function InviteButton({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <MailPlus aria-hidden />
        Invite someone
      </Button>
      {/* Mounted only while open, so every invitation starts with an empty form. */}
      {open ? <InviteDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    const name = fullName.trim();
    const address = email.trim();
    if (name === "") {
      setProblem("Enter their name, as colleagues will see it.");
      return;
    }
    if (!LOOKS_LIKE_EMAIL.test(address)) {
      setProblem("Enter a complete email address, like nino@acme.com.");
      return;
    }
    setBusy(true);
    setProblem(null);
    const result = await callApi("POST", "/employees", {
      email: address,
      fullName: name,
    });
    if (succeeded(result)) {
      onClose();
      router.refresh();
      return;
    }
    setProblem(messageFor(result));
    setBusy(false);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title="Invite someone"
      description="They get an email with a link to choose a password, or to join with Google."
    >
      <form
        className="flex flex-col gap-5 p-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Field label="Full name" hint="As colleagues will see it.">
          {(control) => (
            <Input
              {...control}
              value={fullName}
              maxLength={120}
              autoComplete="off"
              placeholder="Nino Beridze"
              autoFocus
              onChange={(event) => {
                setProblem(null);
                setFullName(event.target.value);
              }}
            />
          )}
        </Field>
        <Field
          label="Email"
          hint="Where the invitation goes. It is also the address they sign in with."
        >
          {(control) => (
            <Input
              {...control}
              type="email"
              value={email}
              autoComplete="off"
              placeholder="nino@acme.com"
              onChange={(event) => {
                setProblem(null);
                setEmail(event.target.value);
              }}
            />
          )}
        </Field>
        <p className="text-sm text-text-muted">
          An invitation holds a seat on your plan straight away, but you are not
          billed for the person until they accept.
        </p>

        {problem ? (
          <p role="alert" className="font-medium text-hold">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : null}
            Send invitation
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
