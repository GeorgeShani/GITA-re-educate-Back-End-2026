import { cookies } from "next/headers";
import { REFRESH_COOKIE } from "@/lib/session/config";
import { refreshTokens, unavailableResponse } from "@/lib/session/refresh";
import { forbidden, isSameOrigin } from "@/lib/session/request";
import { clearSession, writeSession } from "@/lib/session/tokens";

/** Trades the refresh cookie for fresh ones. 204 on success, 401 (cookies cleared) when the session is over. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  const renewal = refreshToken ? await refreshTokens(refreshToken) : null;
  if (renewal?.kind === "unavailable") return unavailableResponse();
  if (renewal?.kind !== "renewed") {
    clearSession(jar);
    return Response.json(
      { statusCode: 401, message: "Your session has ended. Sign in again." },
      { status: 401 },
    );
  }
  writeSession(jar, renewal.tokens);
  return new Response(null, { status: 204 });
}
