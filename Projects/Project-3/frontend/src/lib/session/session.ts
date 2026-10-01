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
 * Who is signed in, or `null`. Asks the API every time (once per request) rather than trusting a cookie's claims: a
 * disabled person or a suspended company stops working on the very next page load, which is how the API treats tokens too.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;
  try {
    const { data } = await apiClient(accessToken).GET("/auth/me");
    return data
      ? { user: data.user, company: data.company, accessToken }
      : null;
  } catch {
    return null;
  }
});

/** The page for signed-in people. Not signed in (or the API refused the token): clear the cookies and go to sign-in. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (session) return session;
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
