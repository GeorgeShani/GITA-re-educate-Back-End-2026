import { cookies } from "next/headers";
import { apiClient } from "@/lib/session/api";
import { publicOrigin } from "@/lib/session/request";
import { toTokens, writeSession } from "@/lib/session/tokens";

/**
 * Google sends the person back to the API, which redirects here with a 60-second, single-use `code` (never a token in a
 * URL). It is traded once for a session, and the cookies are set here.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const failed = (reason: string) =>
    Response.redirect(
      new URL(`/login?error=${encodeURIComponent(reason)}`, origin),
      303,
    );

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
    writeSession(await cookies(), tokens);
    return Response.redirect(new URL("/dashboard", origin), 303);
  } catch {
    return failed("provider_error");
  }
}
