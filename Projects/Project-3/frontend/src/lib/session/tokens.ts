import "server-only";
import { isRecord } from "@/lib/guards";
import {
  ACCESS_COOKIE,
  isProduction,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
} from "./config";

/** What the API's `SessionDto` carries. */
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

/** Anything cookies can be written to: `cookies()` in an action or handler, or a `NextResponse`'s cookies. */
export interface CookieSink {
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax";
      path: string;
      maxAge: number;
    },
  ): unknown;
}

const base = { httpOnly: true, secure: isProduction, sameSite: "lax" } as const;

/**
 * Stores a session. The access cookie expires with the access token, so "no access cookie" is how the proxy learns it is
 * time to refresh. The refresh cookie is only ever sent to the session routes, never to a page.
 */
export function writeSession(sink: CookieSink, tokens: Tokens): void {
  sink.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: "/",
    maxAge: Math.max(1, tokens.expiresIn - 5),
  });
  sink.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    path: "/",
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearSession(sink: CookieSink): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    sink.set(name, "", { ...base, path: "/", maxAge: 0 });
  }
}

/** Reads the API's session body without trusting it: all three fields must be there. */
export function toTokens(body: unknown): Tokens | null {
  if (!isRecord(body)) return null;
  const { accessToken, refreshToken, expiresIn } = body;
  if (
    typeof accessToken === "string" &&
    typeof refreshToken === "string" &&
    typeof expiresIn === "number"
  ) {
    return { accessToken, refreshToken, expiresIn };
  }
  return null;
}
