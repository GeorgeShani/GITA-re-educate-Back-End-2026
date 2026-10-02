import Link from "next/link";
import { PasswordForm } from "@/features/settings/password-form";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Password and security" };

export default async function Page() {
  const session = await requireSession();
  const identities = await apiClient(session.accessToken).GET(
    "/auth/identities",
  );
  // Someone who joined with Google alone has no password to change. If the list could not be read, assume they do.
  const hasPassword =
    identities.data?.data.some(
      (identity) => identity.provider === "password",
    ) ?? true;

  return (
    <section aria-labelledby="security-heading" className="flex flex-col gap-4">
      <h2 id="security-heading" className="text-2xl font-semibold">
        Password and security
      </h2>
      {hasPassword ? (
        <>
          <p className="max-w-prose text-text-muted">
            Changing your password signs you out everywhere else, so anyone who
            had got hold of the old one is out too. You stay signed in here.
          </p>
          <PasswordForm />
        </>
      ) : (
        <div className="leaf flex max-w-xl flex-col gap-2 p-5">
          <p className="font-semibold">This account has no password</p>
          <p className="text-text-muted">
            There is nothing to change here. To add another way to sign in, see{" "}
            <Link
              href="/settings/linked-accounts"
              className="font-semibold text-text underline underline-offset-2"
            >
              Linked accounts
            </Link>
            .
          </p>
        </div>
      )}
    </section>
  );
}
