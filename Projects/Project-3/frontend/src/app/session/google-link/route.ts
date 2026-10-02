import { cookies } from "next/headers";
import { isRecord } from "@/lib/guards";
import {
  ACCESS_COOKIE,
  API_ORIGIN,
  REFRESH_COOKIE,
} from "@/lib/session/config";
import { refreshTokens } from "@/lib/session/refresh";
import { forbidden, isSameOrigin, seeOther } from "@/lib/session/request";
import { writeSession } from "@/lib/session/tokens";

const BACK = "/settings/linked-accounts";

/**
 * "Connect Google" from Settings. Like /session/google, but for someone already signed in: the API needs their session to
 * know whose account the Google account will be attached to, and it answers with Google's address AND the short-lived
 * cookie that ties this browser to the flow, which is passed through untouched.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const jar = await cookies();
  const failed = (code: string) => seeOther(request, `${BACK}?error=${code}`);

  let accessToken = jar.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    const refreshToken = jar.get(REFRESH_COOKIE)?.value;
    const renewal = refreshToken ? await refreshTokens(refreshToken) : null;
    if (renewal?.kind === "unavailable") return failed("google_unavailable");
    if (renewal?.kind !== "renewed")
      return seeOther(request, "/session/expired");
    writeSession(jar, renewal.tokens);
    accessToken = renewal.tokens.accessToken;
  }

  try {
    const response = await fetch(`${API_ORIGIN}/auth/identities/google/link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (response.status === 401) return seeOther(request, "/session/expired");
    const body: unknown = await response.json();
    const url = isRecord(body) ? body.url : null;
    if (!response.ok || typeof url !== "string") {
      return failed("google_unavailable");
    }
    const headers = new Headers({ Location: url });
    for (const cookie of response.headers.getSetCookie()) {
      headers.append("Set-Cookie", cookie);
    }
    return new Response(null, { status: 303, headers });
  } catch {
    return failed("google_unavailable");
  }
}
