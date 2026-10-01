import Link from "next/link";
import { AuthHeading } from "@/features/auth/auth-heading";
import { ForgotPasswordForm } from "@/features/auth/forms";
import { redirectIfSignedIn } from "@/lib/session/session";

export const metadata = { title: "Reset your password" };

export default async function Page() {
  await redirectIfSignedIn("/settings/security");
  return (
    <>
      <AuthHeading title="Forgot your password?">
        Enter the address you sign in with and we will email you a link to
        choose a new one.
      </AuthHeading>
      <ForgotPasswordForm />
      <p className="border-t border-line pt-5 text-sm text-text-muted">
        Remembered it?{" "}
        <Link href="/login" className="link-draw font-semibold text-text">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
