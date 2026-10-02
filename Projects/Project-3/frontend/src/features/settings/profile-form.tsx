"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";

/** Your name, as colleagues see it. The email is shown, not edited: it is how you sign in and where invitations went. */
export function ProfileForm({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: "admin" | "employee";
}) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      setProblem("Enter your name, as colleagues should see it.");
      return;
    }
    setBusy(true);
    setProblem(null);
    setSaved(false);
    const result = await callApi("PATCH", "/users/me", { fullName: trimmed });
    if (succeeded(result)) {
      setSaved(true);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <form
      className="leaf flex max-w-xl flex-col gap-5 p-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Field
        label="Full name"
        hint="Shown on your uploads and comments, and in lists of colleagues."
      >
        {(control) => (
          <Input
            {...control}
            value={name}
            maxLength={120}
            autoComplete="name"
            onChange={(event) => {
              setSaved(false);
              setProblem(null);
              setName(event.target.value);
            }}
          />
        )}
      </Field>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-text-muted">Email</dt>
          <dd className="break-words">{email}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-text-muted">Role</dt>
          <dd>{role === "admin" ? "Admin" : "Employee"}</dd>
        </div>
      </dl>

      {problem ? (
        <p role="alert" className="font-medium text-hold">
          {problem}
        </p>
      ) : null}
      {saved ? (
        <output className="block font-medium text-pass">Saved.</output>
      ) : null}
      <div>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}
