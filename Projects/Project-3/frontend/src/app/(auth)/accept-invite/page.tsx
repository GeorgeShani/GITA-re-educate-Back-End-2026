import { AuthHeading, first, Notice } from "@/features/auth/auth-heading";
import { GoogleButton, OrDivider } from "@/features/auth/form-parts";
import { AcceptInviteForm } from "@/features/auth/forms";
import { messageForError } from "@/features/auth/messages";
import { redirectIfSignedIn } from "@/lib/session/session";

export const metadata = { title: "Join your team" };

/**
 * The link in an invitation email lands here. The token proves who the invitation is for, so there is no email to type:
 * choose a password, or join with Google. Whether the link is still good is the API's to say, when the form is sent.
 */
export default async function Page({
  searchParams,
}: PageProps<"/accept-invite">) {
  await redirectIfSignedIn();
  const params = await searchParams;
  const token = first(params.token);
  const error = messageForError(first(params.error));

  if (!token) {
    return (
      <>
        <AuthHeading title="Invitation incomplete" />
        <Notice>
          This invitation link is missing its code. Open it from the email
          again, or ask your admin to send a new one.
        </Notice>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Join your team">
        You were invited to your company's Gridline. Choose how you will sign
        in.
      </AuthHeading>
      {error ? <Notice>{error}</Notice> : null}
      <GoogleButton intent="invite" inviteToken={token}>
        Join with Google
      </GoogleButton>
      <OrDivider />
      <AcceptInviteForm token={token} />
    </>
  );
}
