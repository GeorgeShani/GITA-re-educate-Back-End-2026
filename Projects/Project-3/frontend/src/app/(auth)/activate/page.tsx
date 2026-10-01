import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthHeading, first } from "@/features/auth/auth-heading";
import { ResendActivationForm } from "@/features/auth/forms";
import { apiClient, toProblem } from "@/lib/session/api";

export const metadata = { title: "Activate your account" };

/** The link in the activation email lands here. It is spent by loading this page, so it is checked on the server, once. */
export default async function Page({ searchParams }: PageProps<"/activate">) {
  const token = first((await searchParams).token);

  let failure: string | null = null;
  if (!token) {
    failure =
      "This activation link is incomplete. Open it from the email again.";
  } else {
    try {
      const { response, error } = await apiClient().GET("/auth/activate", {
        params: { query: { token } },
      });
      if (!response.ok)
        failure = toProblem(response, error).messages[0] ?? null;
    } catch {
      failure =
        "We could not reach Gridline to activate your account. Try the link again in a moment.";
    }
  }

  if (failure) {
    return (
      <>
        <AuthHeading title="Not activated" />
        <div
          role="alert"
          className="flex gap-2.5 rounded-md border border-hold bg-hold-soft p-3 text-sm font-medium text-hold"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {failure}
        </div>
        <div className="leaf flex flex-col gap-3 p-5">
          <p className="text-sm text-text-muted">
            Links work once and for a limited time. Enter the address you
            registered with and we will send a fresh one.
          </p>
          <ResendActivationForm />
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="You are in">
        Your company is active. Sign in to choose a plan and upload your first
        file.
      </AuthHeading>
      <output className="flex gap-2.5 rounded-md border border-pass bg-pass-soft p-3 text-sm font-medium text-pass">
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        Account activated.
      </output>
      <Button asChild variant="primary" size="lg">
        <Link href="/login">Sign in</Link>
      </Button>
    </>
  );
}
