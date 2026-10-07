import "server-only";
import { isRecord } from "@/lib/guards";
import { isProduction } from "./config";
import { safeNext } from "./session";

/** Remembers where "Continue with Google" was pressed from, across the trip to Google and back. */
export const OAUTH_RETURN_COOKIE = "gl_oauth_return";

const MAX_AGE_SECONDS = 10 * 60;

export interface OAuthReturn {
  /** Where to go once signed in (a page the person was sent to sign in for). */
  after: string;
  /** Where the form was, so a failure puts the person back on it (an invitation keeps its token). */
  back: string;
}

/** A path on this site, or the fallback: nothing read back from a cookie is trusted to be one. */
function localPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return fallback;
  }
  return value;
}

/** The `Set-Cookie` header for the return cookie. httpOnly: it is never read by the page, only by the callback route. */
export function returnCookieHeader(value: OAuthReturn): string {
  const body = encodeURIComponent(JSON.stringify(value));
  return `${OAUTH_RETURN_COOKIE}=${body}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${
    isProduction ? "; Secure" : ""
  }`;
}

export function clearReturnCookieHeader(): string {
  return `${OAUTH_RETURN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${
    isProduction ? "; Secure" : ""
  }`;
}

export function readReturn(raw: string | undefined): OAuthReturn {
  const fallback: OAuthReturn = { after: "/dashboard", back: "/login" };
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (!isRecord(parsed)) return fallback;
    return {
      after: safeNext(typeof parsed.after === "string" ? parsed.after : null),
      back: localPath(parsed.back, fallback.back),
    };
  } catch {
    return fallback;
  }
}

/** Puts an error code on a path that may already have a query string (an invitation's `?token=`). */
export function withError(path: string, reason: string): string {
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}error=${encodeURIComponent(reason)}`;
}
