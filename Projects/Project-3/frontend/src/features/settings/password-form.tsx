"use client";

import { useActionState } from "react";
import {
  FormErrors,
  PasswordField,
  SubmitButton,
} from "@/features/auth/form-parts";
import { IDLE } from "@/features/auth/form-state";
import { changePassword } from "./actions";

/** Current password, then the new one twice. Saving signs every other device out and keeps this one signed in. */
export function PasswordForm() {
  const [state, action] = useActionState(changePassword, IDLE);
  return (
    <form action={action} className="leaf flex max-w-xl flex-col gap-5 p-5">
      <PasswordField
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
      />
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        hint="At least 8 characters, and different from the current one."
        minLength={8}
      />
      <PasswordField
        label="New password again"
        name="confirmPassword"
        autoComplete="new-password"
        minLength={8}
      />
      <FormErrors state={state} />
      {state.status === "saved" ? (
        <output className="block rounded-md border border-pass bg-pass-soft p-3 font-medium text-pass">
          {state.message}
        </output>
      ) : null}
      <div>
        <SubmitButton pending="Saving…" size="md" className="w-auto">
          Change password
        </SubmitButton>
      </div>
    </form>
  );
}
