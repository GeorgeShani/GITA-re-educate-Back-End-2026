"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Field, Input, inputStyles } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  acceptInvite,
  forgotPassword,
  login,
  registerCompany,
  registerWithGoogle,
  resendActivation,
  resetPassword,
} from "./actions";
import { FormErrors, PasswordField, SubmitButton } from "./form-parts";
import { type FormState, IDLE } from "./form-state";
import { INDUSTRIES } from "./geo";

/** What a refused form remembers so the person need not retype it. */
function remembered(state: FormState, name: string): string | undefined {
  return state.status === "error" ? state.values[name] : undefined;
}

const emailField = (state: FormState, readOnly?: string) => (
  <Field label="Email address">
    {(control) => (
      <Input
        {...control}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        maxLength={254}
        defaultValue={readOnly ?? remembered(state, "email")}
      />
    )}
  </Field>
);

/** The "we sent you a link" state, shared by every form that ends in an email. */
function Sent({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-live="polite" className="leaf flex flex-col gap-3 p-5">
      <MailCheck aria-hidden className="size-6" />
      <p className="font-semibold">Check {email || "your inbox"}.</p>
      <div className="text-sm text-text-muted">{children}</div>
    </div>
  );
}

/** Ask for the activation email again. Always answers the same, so it never reveals which addresses have accounts. */
export function ResendActivation({ email }: { email: string }) {
  const [state, action] = useActionState(resendActivation, IDLE);
  if (state.status === "sent") {
    return (
      <output className="block text-sm font-medium">
        If that address has an account waiting, a new link is on its way.
      </output>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      <SubmitButton variant="secondary" size="sm" pending="Sending…">
        Send the activation email again
      </SubmitButton>
      <FormErrors state={state} />
    </form>
  );
}

/** For someone whose link failed: they type the address, and the answer is the same whether or not it has an account. */
export function ResendActivationForm() {
  const [state, action] = useActionState(resendActivation, IDLE);
  if (state.status === "sent") {
    return (
      <output className="block text-sm font-medium">
        If that address has an account waiting, a new link is on its way.
      </output>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <FormErrors state={state} />
      <form action={action} className="flex flex-col gap-3">
        {emailField(state)}
        <SubmitButton pending="Sending…">Send a new link</SubmitButton>
      </form>
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, IDLE);
  return (
    <div className="flex flex-col gap-4">
      <FormErrors state={state} />
      {state.status === "error" && state.needsActivation ? (
        <ResendActivation email={state.values.email ?? ""} />
      ) : null}
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        {emailField(state)}
        <PasswordField autoComplete="current-password" />
        <div className="-mt-1 flex justify-end">
          <Link
            href="/forgot-password"
            className="link-draw text-sm font-medium text-text"
          >
            Forgot your password?
          </Link>
        </div>
        <SubmitButton pending="Signing in…">Sign in</SubmitButton>
      </form>
    </div>
  );
}

/** Name, country and industry: what a company is, whichever way it registers. */
function CompanyFields({
  state,
  countries,
}: {
  state: FormState;
  countries: readonly { code: string; name: string }[];
}) {
  return (
    <>
      <Field label="Company name">
        {(control) => (
          <Input
            {...control}
            name="companyName"
            autoComplete="organization"
            required
            minLength={2}
            maxLength={120}
            defaultValue={remembered(state, "companyName")}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Country">
          {(control) => (
            <select
              {...control}
              name="country"
              autoComplete="country"
              required
              defaultValue={remembered(state, "country") ?? ""}
              className={cn(inputStyles(), "pr-8")}
            >
              <option value="" disabled>
                Choose…
              </option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Industry">
          {(control) => (
            <select
              {...control}
              name="industry"
              required
              defaultValue={remembered(state, "industry") ?? ""}
              className={cn(inputStyles(), "pr-8")}
            >
              <option value="" disabled>
                Choose…
              </option>
              {INDUSTRIES.map((industry) => (
                <option key={industry.value} value={industry.value}>
                  {industry.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </>
  );
}

export function RegisterForm({
  countries,
}: {
  countries: readonly { code: string; name: string }[];
}) {
  const [state, action] = useActionState(registerCompany, IDLE);
  if (state.status === "sent") {
    return (
      <Sent email={state.email}>
        <p>
          Your company is created but not active yet. Open the link we sent to
          switch it on, then sign in. It can take a minute to arrive.
        </p>
        <div className="mt-3">
          <ResendActivation email={state.email} />
        </div>
      </Sent>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <FormErrors state={state} />
      <form action={action} className="flex flex-col gap-4">
        <CompanyFields state={state} countries={countries} />
        {emailField(state)}
        <PasswordField
          autoComplete="new-password"
          hint="At least 8 characters."
          minLength={8}
        />
        <SubmitButton pending="Creating your company…">
          Create company
        </SubmitButton>
      </form>
    </div>
  );
}

/** Finishing a registration that began at Google: who they are is already known, the company is what is missing. */
export function GoogleRegisterForm({
  token,
  email,
  emailVerified,
  countries,
}: {
  token: string;
  /** Google's address when it can be trusted as a contact address; otherwise empty and the person types one. */
  email: string | null;
  emailVerified: boolean;
  countries: readonly { code: string; name: string }[];
}) {
  const [state, action] = useActionState(registerWithGoogle, IDLE);
  if (state.status === "sent") {
    return (
      <Sent email={state.email}>
        <p>
          Open the link we sent to activate your company, then sign in with
          Google again.
        </p>
      </Sent>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <FormErrors state={state} />
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="oauthRegistrationToken" value={token} />
        <CompanyFields state={state} countries={countries} />
        {emailVerified && email ? (
          <p className="text-sm text-text-muted">
            Your company will use <strong className="text-text">{email}</strong>
            , the address Google confirmed.
          </p>
        ) : (
          <Field
            label="Work email"
            hint="Google did not give us an address we can use. Invitations and invoices go here."
          >
            {(control) => (
              <Input
                {...control}
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                defaultValue={remembered(state, "email") ?? email ?? ""}
              />
            )}
          </Field>
        )}
        <SubmitButton pending="Creating your company…">
          Create company
        </SubmitButton>
      </form>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPassword, IDLE);
  if (state.status === "sent") {
    return (
      <Sent email={state.email}>
        <p>
          If that address has an account, a link to choose a new password is on
          its way. It works once, and for a short time.
        </p>
      </Sent>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <FormErrors state={state} />
      <form action={action} className="flex flex-col gap-4">
        {emailField(state)}
        <SubmitButton pending="Sending…">Send the link</SubmitButton>
      </form>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, IDLE);
  return (
    <div className="flex flex-col gap-4">
      <FormErrors state={state}>
        <Link href="/forgot-password" className="link-draw font-semibold">
          Ask for a new link
        </Link>
      </FormErrors>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters. Signing in again is required everywhere afterwards."
          minLength={8}
        />
        <SubmitButton pending="Saving…">Set the new password</SubmitButton>
      </form>
    </div>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvite, IDLE);
  return (
    <div className="flex flex-col gap-4">
      <FormErrors state={state} />
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <PasswordField
          label="Choose a password"
          autoComplete="new-password"
          hint="At least 8 characters."
          minLength={8}
        />
        <SubmitButton pending="Joining…">Join your team</SubmitButton>
      </form>
    </div>
  );
}
