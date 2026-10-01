import { isRecord } from "@/lib/guards";
import { API_ORIGIN } from "@/lib/session/config";
import { forbidden, isSameOrigin, seeOther } from "@/lib/session/request";

const INTENTS = ["login", "register", "invite"] as const;
type Intent = (typeof INTENTS)[number];

function toIntent(value: FormDataEntryValue | null): Intent {
  return INTENTS.find((intent) => intent === value) ?? "login";
}

/**
 * "Continue with Google". The API answers with Google's address AND sets a short-lived cookie that ties this browser to
 * the flow (it is what stops someone else's Google response being signed in here). That cookie must reach the browser, so
 * its header is passed through untouched; the API puts no domain on it, so it belongs to this site.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const form = await request.formData();
  const intent = toIntent(form.get("intent"));
  const inviteToken = form.get("inviteToken");
  const back =
    intent === "invite"
      ? "/accept-invite"
      : intent === "register"
        ? "/register"
        : "/login";
  const failed = () =>
    seeOther(
      request,
      `${back}?error=google_unavailable${
        typeof inviteToken === "string" && inviteToken
          ? `&token=${encodeURIComponent(inviteToken)}`
          : ""
      }`,
    );

  try {
    const response = await fetch(`${API_ORIGIN}/auth/oauth/google/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent,
        ...(typeof inviteToken === "string" && inviteToken
          ? { inviteToken }
          : {}),
      }),
      cache: "no-store",
    });
    const body: unknown = await response.json();
    const url = isRecord(body) ? body.url : null;
    if (!response.ok || typeof url !== "string") return failed();

    const headers = new Headers({ Location: url });
    for (const cookie of response.headers.getSetCookie()) {
      headers.append("Set-Cookie", cookie);
    }
    return new Response(null, { status: 303, headers });
  } catch {
    return failed();
  }
}
