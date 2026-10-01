import "server-only";
import { apiClient } from "./api";
import { type Tokens, toTokens } from "./tokens";

/**
 * Refresh tokens ROTATE: presenting a spent one revokes the whole session family. A page load fires several requests at
 * once (the page, its prefetches, data calls), and each would find the access cookie gone and try to refresh with the
 * same token. So one refresh per token is shared by everyone who asks within a short window, and its answer is kept for a
 * few seconds for the stragglers.
 */
const KEEP_MS = 15_000;
const recent = new Map<
  string,
  { at: number; result: Promise<Tokens | null> }
>();

export function refreshTokens(refreshToken: string): Promise<Tokens | null> {
  const now = Date.now();
  for (const [token, entry] of recent) {
    if (now - entry.at > KEEP_MS) recent.delete(token);
  }

  const existing = recent.get(refreshToken);
  if (existing) return existing.result;

  const result = requestNewTokens(refreshToken);
  recent.set(refreshToken, { at: now, result });
  return result;
}

async function requestNewTokens(refreshToken: string): Promise<Tokens | null> {
  try {
    const { data } = await apiClient().POST("/auth/refresh", {
      body: { refreshToken },
    });
    return toTokens(data);
  } catch {
    return null;
  }
}
