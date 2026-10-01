import { cookies } from "next/headers";
import { apiClient } from "@/lib/session/api";
import { forbidden, isSameOrigin, seeOther } from "@/lib/session/request";
import { toTokens, writeSession } from "@/lib/session/tokens";

/** "Explore the demo": a session for the read-only demo company. A POST because it creates a session. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  try {
    const { data } = await apiClient().POST("/auth/demo");
    const tokens = toTokens(data);
    if (tokens) {
      writeSession(await cookies(), tokens);
      return seeOther(request, "/dashboard");
    }
  } catch {
    // Falls through to the notice below.
  }
  return seeOther(request, "/login?error=demo_unavailable");
}
