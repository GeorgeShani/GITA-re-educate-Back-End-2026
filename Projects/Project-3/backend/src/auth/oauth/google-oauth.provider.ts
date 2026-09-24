import { z } from 'zod';
import type { OAuthProfile, OAuthProvider } from './oauth-provider.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const TIMEOUT_MS = 10_000;

const tokenResponse = z.object({ access_token: z.string().min(1) });
const userInfo = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

/**
 * Authorization-code flow over plain `fetch`, so `state` stays entirely ours.
 *
 * The profile comes from Google's userinfo endpoint, called with the access token
 * Google's token endpoint returned in exchange for our code AND our client secret,
 * over TLS, server to server. That back channel — not a token a browser handed us —
 * is what makes the claims trustworthy without verifying an ID token's signature
 * (OpenID Connect Core §3.1.3.7 permits exactly this).
 */
export class GoogleOAuthProvider implements OAuthProvider {
  readonly provider = 'google';

  constructor(
    private readonly config: GoogleOAuthConfig,
    private readonly http: typeof fetch = fetch,
  ) {}

  authorizationUrl(state: string): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    // Always show the account chooser: signing in as the wrong Google account
    // silently is the commonest way to end up on the wrong Gridline account.
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }

  async exchangeCode(code: string): Promise<OAuthProfile> {
    const tokenRes = await this.http(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.callbackUrl,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!tokenRes.ok) throw new Error(`Google token endpoint answered ${tokenRes.status}`);
    const { access_token } = tokenResponse.parse(await tokenRes.json());

    const infoRes = await this.http(USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!infoRes.ok) throw new Error(`Google userinfo endpoint answered ${infoRes.status}`);
    const info = userInfo.parse(await infoRes.json());

    return {
      providerUserId: info.sub,
      email: info.email ?? null,
      // Absent means unverified: never assume the good case.
      emailVerified: info.email_verified === true,
      name: info.name ?? null,
    };
  }
}
