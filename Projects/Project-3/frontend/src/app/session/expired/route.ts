import { cookies } from "next/headers";
import { publicOrigin } from "@/lib/session/request";
import { safeNext } from "@/lib/session/session";
import { clearSession } from "@/lib/session/tokens";

/**
 * Where a page sends someone whose cookies exist but whose session the API no longer accepts (signed out elsewhere, a
 * disabled account). Clearing the cookies is what stops "sign-in sends you to the dashboard, which sends you to sign-in".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  clearSession(await cookies());
  const login = new URL("/login", publicOrigin(request));
  const next = url.searchParams.get("next");
  if (next) login.searchParams.set("next", safeNext(next));
  login.searchParams.set("reason", "expired");
  return Response.redirect(login, 303);
}
