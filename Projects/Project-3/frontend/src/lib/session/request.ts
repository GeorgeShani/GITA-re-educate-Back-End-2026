import "server-only";

/**
 * Cookies are sent with every request to this site, including ones a different site's page makes. A route that changes
 * something must therefore be asked by THIS site: `Sec-Fetch-Site` says so in every current browser, and `Origin` covers
 * the rest. A caller with neither is not a browser, so it has no ambient cookie to abuse.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbidden(): Response {
  return Response.json(
    { statusCode: 403, message: "This request did not come from Gridline." },
    { status: 403 },
  );
}

/**
 * The address the visitor used. Behind Caddy `request.url` names the internal host (`web:3000`), so redirects built from
 * it would send people to an address they cannot reach.
 */
export function publicOrigin(request: Request): string {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/** A redirect to a path on this site, as a 303 so a POST is followed by a GET. */
export function seeOther(request: Request, path: string): Response {
  return Response.redirect(new URL(path, publicOrigin(request)), 303);
}
