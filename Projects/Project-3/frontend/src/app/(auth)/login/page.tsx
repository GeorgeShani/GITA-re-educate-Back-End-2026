import Link from "next/link";
import { DemoButton } from "@/components/marketing/demo-button";
import { AuthHeading, first, Notice } from "@/features/auth/auth-heading";
import { GoogleButton, OrDivider } from "@/features/auth/form-parts";
import { LoginForm } from "@/features/auth/forms";
import { messageForError } from "@/features/auth/messages";
import { redirectIfSignedIn, safeNext } from "@/lib/session/session";

export const metadata = { title: "Sign in" };

export default async function Page({ searchParams }: PageProps<"/login">) {
  await redirectIfSignedIn();
  const params = await searchParams;
  const next = safeNext(first(params.next));
  const error = messageForError(first(params.error));

  return (
    <>
      <AuthHeading title="Sign in">
        Back to your company's spreadsheets.
      </AuthHeading>

      {first(params.reset) ? (
        <Notice tone="pass">
          Your password is changed. Sign in with the new one.
        </Notice>
      ) : null}
      {first(params.reason) === "expired" ? (
        <Notice>You were signed out. Sign in to carry on.</Notice>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}

      <GoogleButton intent="login" />
      <OrDivider />
      <LoginForm next={next} />

      <div className="flex flex-col gap-3 border-t border-line pt-5 text-sm">
        <p className="text-text-muted">
          New to Gridline?{" "}
          <Link href="/register" className="link-draw font-semibold text-text">
            Create a company
          </Link>
        </p>
        <DemoButton variant="ghost" size="sm" block>
          Just looking? Explore the demo
        </DemoButton>
      </div>
    </>
  );
}
