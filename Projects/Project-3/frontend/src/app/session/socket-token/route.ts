import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session/config";
import { refreshTokens } from "@/lib/session/refresh";
import { forbidden, isSameOrigin } from "@/lib/session/request";
import { clearSession, writeSession } from "@/lib/session/tokens";

/**
 * The live connection (Socket.IO) authenticates with the access token in its handshake, and the browser cannot read an
 * httpOnly cookie. So the token is handed over here, to this site's own pages only, and it is the short-lived one.
 */
export async function GET(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const jar = await cookies();

  let accessToken = jar.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    const refreshToken = jar.get(REFRESH_COOKIE)?.value;
    const tokens = refreshToken ? await refreshTokens(refreshToken) : null;
    if (!tokens) {
      clearSession(jar);
      return Response.json(
        { statusCode: 401, message: "Your session has ended. Sign in again." },
        { status: 401 },
      );
    }
    writeSession(jar, tokens);
    accessToken = tokens.accessToken;
  }
  return Response.json(
    { token: accessToken },
    { headers: { "Cache-Control": "no-store" } },
  );
}
