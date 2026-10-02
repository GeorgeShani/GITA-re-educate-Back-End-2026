import "server-only";
import { apiClient } from "./api";
import { type Tokens, toTokens } from "./tokens";

/**
 * How a renewal ended. The difference matters: "refused" means the session is over and the cookies should go, while
 * "unavailable" means the API could not be asked (it is restarting, or a network fault, or it is throttling) and the
 * session may be perfectly fine. Treating the second like the first signs people out whenever the API blinks.
 */
export type Renewal =
  | { kind: "renewed"; tokens: Tokens }
  | { kind: "refused" }
  | { kind: "unavailable" };

/**
 * Refresh tokens ROTATE: presenting a spent one revokes the whole session family. A page load fires several requests at
 * once (the page, its prefetches, data calls), and each would find the access cookie gone and try to refresh with the
 * same token. So one refresh per token is shared by everyone who asks within a short window, and its answer is kept for a
 * few seconds for the stragglers. An "unavailable" answer is not kept: the very next ask should try again.
 */
const KEEP_MS = 15_000;
const recent = new Map<string, { at: number; result: Promise<Renewal> }>();

export function refreshTokens(refreshToken: string): Promise<Renewal> {
  const now = Date.now();
  for (const [token, entry] of recent) {
    if (now - entry.at > KEEP_MS) recent.delete(token);
  }

  const existing = recent.get(refreshToken);
  if (existing) return existing.result;

  const result = requestNewTokens(refreshToken);
  const entry = { at: now, result };
  recent.set(refreshToken, entry);
  void result.then((renewal) => {
    if (renewal.kind === "unavailable" && recent.get(refreshToken) === entry) {
      recent.delete(refreshToken);
    }
  });
  return result;
}

async function requestNewTokens(refreshToken: string): Promise<Renewal> {
  try {
    const { data, response } = await apiClient().POST("/auth/refresh", {
      body: { refreshToken },
    });
    const tokens = toTokens(data);
    if (response.ok && tokens) return { kind: "renewed", tokens };
    // A client error other than "slow down" is the API saying this refresh token is not good (expired, spent, revoked).
    if (
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 429
    ) {
      return { kind: "refused" };
    }
    return { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** What to tell the browser when a renewal could not be attempted: not signed out, just try again shortly. */
export function unavailableResponse(): Response {
  return Response.json(
    {
      statusCode: 503,
      message: "Gridline is briefly unavailable. Try again in a moment.",
    },
    { status: 503, headers: { "Retry-After": "3" } },
  );
}
