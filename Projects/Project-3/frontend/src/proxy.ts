import { NextResponse } from "next/server";

/**
 * Next 16's "proxy" (the former middleware). The session gate lands here with the BFF: every (app) route will need
 * the session cookie or redirect to /login?next=. Until then it lets every request through.
 */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and files with an extension.
  matcher: ["/((?!_next/|api/health|.*\\..*).*)"],
};
