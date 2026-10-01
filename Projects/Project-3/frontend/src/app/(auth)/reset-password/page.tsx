import Link from "next/link";
import { AuthHeading, first, Notice } from "@/features/auth/auth-heading";
import { ResetPasswordForm } from "@/features/auth/forms";

export const metadata = { title: "Choose a new password" };

/** The link in the reset email lands here. The token is spent by the form, not by loading the page. */
export default async function Page({
  searchParams,
}: PageProps<"/reset-password">) {
  const token = first((await searchParams).token);

  if (!token) {
    return (
      <>
        <AuthHeading title="Link incomplete" />
        <Notice>
          This reset link is missing its code. Open it from the email again, or
          ask for a new one.
        </Notice>
        <Link href="/forgot-password" className="link-draw font-semibold">
          Ask for a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Choose a new password">
        You will be signed out everywhere and asked to sign in with it.
      </AuthHeading>
      <ResetPasswordForm token={token} />
    </>
  );
}
