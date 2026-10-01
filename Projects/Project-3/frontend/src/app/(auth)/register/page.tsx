import Link from "next/link";
import { AuthHeading, first, Notice } from "@/features/auth/auth-heading";
import { GoogleButton, OrDivider } from "@/features/auth/form-parts";
import { GoogleRegisterForm, RegisterForm } from "@/features/auth/forms";
import { countries } from "@/features/auth/geo";
import { messageForError } from "@/features/auth/messages";
import { apiClient } from "@/lib/session/api";
import { redirectIfSignedIn } from "@/lib/session/session";

export const metadata = { title: "Create your company" };

export default async function Page({ searchParams }: PageProps<"/register">) {
  await redirectIfSignedIn();
  const params = await searchParams;
  const error = messageForError(first(params.error));
  const token = first(params.oauthRegistration);

  // Back from Google with an unknown account: the profile is in the signed token, so only the company is missing.
  if (token) {
    let profile = null;
    try {
      const { data } = await apiClient().POST(
        "/auth/oauth/registration/preview",
        { body: { oauthRegistrationToken: token } },
      );
      profile = data ?? null;
    } catch {
      profile = null;
    }

    if (!profile) {
      return (
        <>
          <AuthHeading title="That link ran out" />
          <Notice>
            The Google sign-in expired before the company was created. Start
            again from the beginning.
          </Notice>
          <GoogleButton intent="register" />
        </>
      );
    }

    return (
      <>
        <AuthHeading title="Almost there">
          {profile.name ? `Hello, ${profile.name}. ` : ""}Google knows who you
          are. Tell us about your company.
        </AuthHeading>
        <GoogleRegisterForm
          token={token}
          email={profile.email}
          emailVerified={profile.emailVerified}
          countries={countries()}
        />
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Create your company">
        Free to start. Upload your first spreadsheet in a few minutes.
      </AuthHeading>
      {error ? <Notice>{error}</Notice> : null}
      <GoogleButton intent="register">Sign up with Google</GoogleButton>
      <OrDivider />
      <RegisterForm countries={countries()} />
      <p className="border-t border-line pt-5 text-sm text-text-muted">
        Already have a company?{" "}
        <Link href="/login" className="link-draw font-semibold text-text">
          Sign in
        </Link>
      </p>
    </>
  );
}
