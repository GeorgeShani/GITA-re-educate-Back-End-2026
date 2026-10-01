import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  API_ORIGIN,
  REFRESH_COOKIE,
} from "@/lib/session/config";
import { refreshTokens } from "@/lib/session/refresh";
import { forbidden, isSameOrigin } from "@/lib/session/request";
import { clearSession, type Tokens, writeSession } from "@/lib/session/tokens";

/**
 * The browser's door to the API: `/session/api/files?limit=5` becomes `GET /files?limit=5` with the session's token. The
 * token lives in an httpOnly cookie, so browser code cannot attach it; this does, and refreshes it once if the API says it
 * has expired. Nothing that hands out a session is reachable through here (see BLOCKED).
 */

/** Routes that return tokens or start/end a session: they belong to the dedicated /session/* handlers, never to browser JS. */
const BLOCKED = [
  /^auth\/login$/,
  /^auth\/refresh$/,
  /^auth\/logout$/,
  /^auth\/demo$/,
  /^auth\/accept-invite$/,
  /^auth\/oauth\/exchange$/,
  /^auth\/oauth\/register-company$/,
];

/** What is passed on to the API, and back. Everything else (cookies, host, hop-by-hop headers) stays here. */
const REQUEST_HEADERS = [
  "accept",
  "content-type",
  "idempotency-key",
  "x-correlation-id",
];
const RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "retry-after",
  "idempotent-replayed",
  "x-correlation-id",
];

function passThrough(from: Headers, names: readonly string[]): Headers {
  const to = new Headers();
  for (const name of names) {
    const value = from.get(name);
    if (value !== null) to.set(name, value);
  }
  for (const [name, value] of from) {
    if (name.startsWith("x-ratelimit-") || name.startsWith("x-gridline-")) {
      to.set(name, value);
    }
  }
  return to;
}

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const target = path.join("/");
  if (BLOCKED.some((pattern) => pattern.test(target))) {
    return Response.json(
      { statusCode: 404, message: "Not found." },
      { status: 404 },
    );
  }
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (mutating && !isSameOrigin(request)) return forbidden();

  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  const renew = () => (refreshToken ? refreshTokens(refreshToken) : null);

  let accessToken = jar.get(ACCESS_COOKIE)?.value;
  let refreshed: Tokens | null = null;
  if (!accessToken) {
    refreshed = await renew();
    if (!refreshed) return ended(jar);
    accessToken = refreshed.accessToken;
  }

  // Buffered, so a request refused for an expired token can be sent again with the new one.
  const body = mutating ? await request.arrayBuffer() : undefined;
  const url = `${API_ORIGIN}/${target}${request.nextUrl.search}`;
  const send = (token: string) => {
    const headers = passThrough(request.headers, REQUEST_HEADERS);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  };

  let upstream: Response;
  try {
    upstream = await send(accessToken);
    if (upstream.status === 401 && !refreshed) {
      refreshed = await renew();
      if (refreshed) upstream = await send(refreshed.accessToken);
    }
  } catch {
    return Response.json(
      { statusCode: 503, message: "We could not reach Gridline." },
      { status: 503 },
    );
  }
  if (upstream.status === 401) return ended(jar);

  if (refreshed) writeSession(jar, refreshed);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: passThrough(upstream.headers, RESPONSE_HEADERS),
  });
}

function ended(jar: Awaited<ReturnType<typeof cookies>>): Response {
  clearSession(jar);
  return Response.json(
    { statusCode: 401, message: "Your session has ended. Sign in again." },
    { status: 401 },
  );
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
