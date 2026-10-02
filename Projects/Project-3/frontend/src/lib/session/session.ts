import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { components } from "@/lib/api/schema";
import { apiClient } from "./api";
import { ACCESS_COOKIE, PATH_HEADER } from "./config";

export type User = components["schemas"]["UserProfileDto"];
export type Company = components["schemas"]["CompanyDto"];

export interface Session {
  user: User;
  company: Company;
  /** For server-side calls on this person's behalf. Never passed to a client component. */
  accessToken: string;
}

/**
 * How the question "who is signed in?" came out. Three answers, because they must be treated differently: someone the
 * API does not recognise is signed out, but an API that is busy (rate-limited), restarting or unreachable has told us
 * nothing about the person, and signing them out for that would throw away a perfectly good session.
 */
type Lookup =
  | { kind: "signed-in"; session: Session }
  | { kind: "signed-out" }
  | { kind: "unavailable" };

/**
 * Asks the API every time (once per request) rather than trusting a cookie's claims: a disabled person or a suspended
 * company stops working on the very next page load, which is how the API treats tokens too.
 */
const lookup = cache(async (): Promise<Lookup> => {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return { kind: "signed-out" };
  try {
    const { data, response } = await apiClient(accessToken).GET("/auth/me");
    if (data) {
      return {
        kind: "signed-in",
        session: { user: data.user, company: data.company, accessToken },
      };
    }
    // "Slow down" and server trouble say nothing about this person. Anything else the API refused is a no.
    return response.status === 429 || response.status >= 500
      ? { kind: "unavailable" }
      : { kind: "signed-out" };
  } catch {
    return { kind: "unavailable" };
  }
});

/**
 * Whether the API could be asked at all. A layout uses this to show a "busy" screen of its own: an error thrown by a layout
 * is not caught by the error page beneath it.
 */
export async function apiIsAvailable(): Promise<boolean> {
  return (await lookup()).kind !== "unavailable";
}

/** Who is signed in, or `null`. An API that could not be asked counts as `null` here: this is for pages that work either way. */
export async function getSession(): Promise<Session | null> {
  const result = await lookup();
  return result.kind === "signed-in" ? result.session : null;
}

/**
 * The page for signed-in people. Not signed in (or the API refused the token): clear the cookies and go to sign-in. The
 * API being busy or down is NOT that: it shows the error page with "try again", and the session is kept.
 */
export async function requireSession(): Promise<Session> {
  const result = await lookup();
  if (result.kind === "signed-in") return result.session;
  if (result.kind === "unavailable") {
    throw new Error("Gridline is busy or briefly unavailable.");
  }
  const path = (await headers()).get(PATH_HEADER);
  redirect(
    path
      ? `/session/expired?next=${encodeURIComponent(path)}`
      : "/session/expired",
  );
}

/** A person who is already signed in has no use for the sign-in pages. */
export async function redirectIfSignedIn(to = "/dashboard"): Promise<void> {
  if (await getSession()) redirect(to);
}

/**
 * Where to go after signing in. Only a path on this site is honoured: anything else (another origin, a protocol-relative
 * `//host`, a backslash trick) would make the sign-in page an open redirect.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//"))
    return "/dashboard";
  if (next.includes("\\") || next.startsWith("/session")) return "/dashboard";
  return next;
}
