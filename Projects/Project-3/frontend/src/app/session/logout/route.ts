import { cookies } from "next/headers";
import { apiClient } from "@/lib/session/api";
import { REFRESH_COOKIE } from "@/lib/session/config";
import { forbidden, isSameOrigin, seeOther } from "@/lib/session/request";
import { clearSession } from "@/lib/session/tokens";

/** Sign out: revoke the refresh token at the API (best effort: the cookies go either way), then go to sign-in. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await apiClient().POST("/auth/logout", { body: { refreshToken } });
    } catch {
      // The session ends here regardless; an unreachable API cannot keep it alive.
    }
  }
  clearSession(jar);
  return seeOther(request, "/login");
}
