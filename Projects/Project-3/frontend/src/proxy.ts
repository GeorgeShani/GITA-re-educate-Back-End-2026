import { type NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  PATH_HEADER,
  REFRESH_COOKIE,
} from "@/lib/session/config";
import { refreshTokens } from "@/lib/session/refresh";
import { clearSession, writeSession } from "@/lib/session/tokens";

/** The signed-in application. Everything else (marketing, docs, the auth pages, /session/*) is open. */
const APP_SECTIONS = [
  "dashboard",
  "welcome",
  "files",
  "quality-rules",
  "employees",
  "notifications",
  "billing",
  "analytics",
  "audit",
  "developers",
  "settings",
];

function isApplication(pathname: string): boolean {
  return APP_SECTIONS.some(
    (section) =>
      pathname === `/${section}` || pathname.startsWith(`/${section}/`),
  );
}

/**
 * Next 16's "proxy" (the former middleware), and the one place a session is kept alive. For an application page:
 *
 *  - an access cookie is there: carry on (the page asks the API who it is, so a revoked token still ends here);
 *  - it has expired but a refresh cookie remains: trade it for fresh tokens BEFORE the page renders, so the page and the
 *    browser both see them;
 *  - neither: send the visitor to sign in, and bring them back to this page afterwards.
 *
 * Every request also gets the path it asked for, so a server component can send someone back after signing in.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, `${pathname}${search}`);

  if (!isApplication(pathname))
    return NextResponse.next({ request: { headers } });
  if (request.cookies.get(ACCESS_COOKIE)?.value) {
    return NextResponse.next({ request: { headers } });
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const renewal = refreshToken ? await refreshTokens(refreshToken) : null;

  // The API could not be asked (restarting, a network fault): the session may be fine, so keep it and say to try again.
  if (renewal?.kind === "unavailable") return briefly();

  if (renewal?.kind !== "renewed") {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    const response = NextResponse.redirect(login);
    if (refreshToken) clearSession(response.cookies);
    return response;
  }

  // The page renders in this same request, so it must see the new cookies too, not only the browser afterwards.
  const { tokens } = renewal;
  request.cookies.set(ACCESS_COOKIE, tokens.accessToken);
  request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  const forwarded = new Headers(headers);
  forwarded.set("cookie", request.cookies.toString());
  const response = NextResponse.next({ request: { headers: forwarded } });
  writeSession(response.cookies, tokens);
  return response;
}

/** A page that tries again by itself in a few seconds, for when the API cannot be reached. Nobody is signed out. */
function briefly(): NextResponse {
  return new NextResponse(
    '<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=3><meta name=viewport content="width=device-width"><title>Gridline</title><body style="font:16px system-ui;padding:2rem"><p>Gridline is briefly unavailable. This page will try again in a moment.</p>',
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": "3",
      },
    },
  );
}

export const config = {
  // Everything except Next internals, the BFF's own routes and files with an extension.
  matcher: ["/((?!_next/|session/|api/health|.*\\..*).*)"],
};
