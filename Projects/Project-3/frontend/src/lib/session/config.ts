import "server-only";

/** Where the server reaches the API directly (container-to-container in Docker). The browser never sees it. */
export const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

/** The two httpOnly cookies that ARE the session. No token ever touches browser JavaScript. */
export const ACCESS_COOKIE = "gl_access";
export const REFRESH_COOKIE = "gl_refresh";

/** The paid plan someone asked for on the pricing page before registering, so the plan picker can offer it first. */
export const WANTED_PLAN_COOKIE = "gl_wanted_plan";

/** The API's refresh tokens live 30 days (REFRESH_TOKEN_TTL_MS); the cookie outlives nothing. */
export const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Header the proxy sets so a server component knows which URL the visitor asked for (to come back after sign-in). */
export const PATH_HEADER = "x-gl-path";

export const isProduction = process.env.NODE_ENV === "production";
