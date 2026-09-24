/**
 * A browser-facing link carrying a single-use token: `${APP_PUBLIC_URL}/activate?token=…`.
 * Built with `URL`, so the token is percent-encoded correctly and a trailing
 * slash on the configured origin can't produce `//activate`.
 */
export function appLink(publicUrl: string, path: string, token: string): string {
  const url = new URL(path, publicUrl);
  url.searchParams.set('token', token);
  return url.toString();
}
