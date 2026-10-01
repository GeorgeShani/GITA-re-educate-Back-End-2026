/**
 * What the API's `?error=` codes (and this site's own) mean to a person, each with the way forward. The OAuth ones are the
 * API's closed list; `google_unavailable` and `demo_unavailable` are this site's.
 */
const MESSAGES: Record<string, string> = {
  access_denied: "You cancelled the Google sign-in. Nothing was changed.",
  invalid_state:
    "That Google sign-in expired or came from another browser. Start again from here.",
  provider_error:
    "Google could not complete the sign-in. Try again, or use your email and password.",
  invalid_invite:
    "That invitation link is no longer valid. Ask your admin to send a new one.",
  identity_in_use:
    "That Google account is already connected to a different Gridline person.",
  already_linked: "You already have a Google account connected.",
  not_activated:
    "Your company is not activated yet. Use the link in the email we sent you.",
  account_unavailable:
    "That account cannot sign in right now. Ask your company's admin.",
  ambiguous_email:
    "That Google address matches more than one company, so we cannot choose for you. Sign in with your email and password.",
  google_unavailable:
    "Google sign-in is not available right now. Use your email and password.",
  demo_unavailable: "The demo is not available right now. Try again shortly.",
};

export function messageForError(code: string | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? "That did not work. Try again.";
}
