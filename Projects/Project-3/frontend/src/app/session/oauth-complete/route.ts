import { cookies } from "next/headers";
import { apiClient } from "@/lib/session/api";
import {
  clearReturnCookieHeader,
  OAUTH_RETURN_COOKIE,
  readReturn,
  withError,
} from "@/lib/session/oauth-return";
import { publicOrigin } from "@/lib/session/request";
import { toTokens, writeSession } from "@/lib/session/tokens";

/**
 * Google sends the person back to the API, which redirects here with a 60-second, single-use `code` (never a token in a
 * URL). It is traded once for a session, and the cookies are set here. Where to go next (the page they were signing in
 * for, or back to the form they were on if it failed) was remembered in a short cookie before they left.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const jar = await cookies();
  const where = readReturn(jar.get(OAUTH_RETURN_COOKIE)?.value);

  // Every way out ends the trip, so every way out clears the cookie that remembered where it started.
  const go = (path: string) =>
    new Response(null, {
      status: 303,
      headers: [
        ["Location", new URL(path, origin).toString()],
        ["Set-Cookie", clearReturnCookieHeader()],
      ],
    });
  const failed = (reason: string) => go(withError(where.back, reason));

  const error = url.searchParams.get("error");
  if (error) return failed(error);
  const code = url.searchParams.get("code");
  if (!code) return failed("provider_error");

  try {
    const { data } = await apiClient().POST("/auth/oauth/exchange", {
      body: { code },
    });
    const tokens = toTokens(data);
    if (!tokens) return failed("invalid_state");
    writeSession(jar, tokens);
    return go(where.after);
  } catch {
    return failed("provider_error");
  }
}
