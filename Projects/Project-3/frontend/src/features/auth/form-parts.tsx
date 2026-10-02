"use client";

import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { FormState } from "./form-state";

/** The form's one primary action. Disabled and labelled while the request runs, so a double click cannot submit twice. */
export function SubmitButton({
  children,
  pending: pendingLabel = "Working…",
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      disabled={pending}
      aria-disabled={pending}
      className="w-full"
      {...props}
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** What went wrong and, in the API's own words, how to fix it. Announced to a screen reader when it appears. */
export function FormErrors({
  state,
  children,
}: {
  state: FormState;
  /** An extra way forward, such as "send the activation email again". */
  children?: React.ReactNode;
}) {
  if (state.status !== "error") return null;
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-md border border-hold bg-hold-soft p-3 text-sm text-hold"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1.5">
        {state.messages.map((message) => (
          <p key={message} className="font-medium">
            {message}
          </p>
        ))}
        {children}
      </div>
    </div>
  );
}

/** A password field that can be shown, because a typo in a hidden field is the commonest way to be locked out. */
export function PasswordField({
  label = "Password",
  name = "password",
  autoComplete,
  hint,
  minLength,
}: {
  label?: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  /** Set when choosing a password; left off when signing in (the API decides what is acceptable there). */
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} hint={hint}>
      {(control) => (
        <div className="relative">
          <Input
            {...control}
            name={name}
            type={shown ? "text" : "password"}
            autoComplete={autoComplete}
            required
            minLength={minLength}
            maxLength={128}
            className="pr-10"
          />
          <button
            type="button"
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            onClick={() => setShown((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-md text-text-muted hover:text-text"
          >
            {shown ? (
              <EyeOff aria-hidden className="size-4" />
            ) : (
              <Eye aria-hidden className="size-4" />
            )}
          </button>
        </div>
      )}
    </Field>
  );
}

/** Google's mark in one colour, so it sits in the palette instead of importing four more. */
export function GoogleMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-4 shrink-0"
      fill="currentColor"
    >
      <title>Google</title>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

/**
 * A plain form post to the BFF, so it works before any script has loaded and the API's cookie can ride the redirect
 * (see /session/google).
 */
export function GoogleButton({
  intent,
  inviteToken,
  children = "Continue with Google",
}: {
  intent: "login" | "register" | "invite";
  inviteToken?: string;
  children?: React.ReactNode;
}) {
  return (
    <form action="/session/google" method="post">
      <input type="hidden" name="intent" value={intent} />
      {inviteToken ? (
        <input type="hidden" name="inviteToken" value={inviteToken} />
      ) : null}
      <Button type="submit" size="lg" className="w-full">
        <GoogleMark />
        {children}
      </Button>
    </form>
  );
}

export function OrDivider() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 text-sm text-text-subtle"
    >
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
