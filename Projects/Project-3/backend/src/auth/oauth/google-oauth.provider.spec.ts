import { describe, expect, it } from 'vitest';
import { GoogleOAuthProvider } from './google-oauth.provider.js';
import { OAUTH_NONCE_COOKIE, readCookie } from './oauth-cookie.js';

const config = {
  clientId: 'client-id.apps.googleusercontent.com',
  clientSecret: 'shh',
  callbackUrl: 'http://localhost:3000/api/auth/google/callback',
};

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** A `fetch` that answers from a script and records what it was asked. */
function scriptedFetch(...responses: Response[]): { http: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const queue = [...responses];
  const http: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    const next = queue.shift();
    if (!next) throw new Error('unexpected extra request');
    return next;
  };
  return { http, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('GoogleOAuthProvider', () => {
  it('builds an authorization-code URL that carries our state and always asks which account', () => {
    const url = new URL(new GoogleOAuthProvider(config).authorizationUrl('the-state'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(config.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(config.callbackUrl);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('the-state');
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('exchanges the code server-side, with the client secret, then reads userinfo', async () => {
    const { http, calls } = scriptedFetch(
      json({ access_token: 'at-1' }),
      json({ sub: '1234', email: 'nino@acme.com', email_verified: true, name: 'Nino' }),
    );

    const profile = await new GoogleOAuthProvider(config, http).exchangeCode('the-code');

    expect(profile).toEqual({
      providerUserId: '1234',
      email: 'nino@acme.com',
      emailVerified: true,
      name: 'Nino',
    });
    expect(calls[0]?.url).toBe('https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(String(calls[0]?.init?.body));
    expect(form.get('code')).toBe('the-code');
    expect(form.get('client_secret')).toBe('shh');
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('redirect_uri')).toBe(config.callbackUrl);
    expect(calls[1]?.init?.headers).toEqual({ Authorization: 'Bearer at-1' });
  });

  it('treats a missing email_verified as unverified, and a missing email as null', async () => {
    const { http } = scriptedFetch(json({ access_token: 'at' }), json({ sub: '9' }));

    expect(await new GoogleOAuthProvider(config, http).exchangeCode('c')).toEqual({
      providerUserId: '9',
      email: null,
      emailVerified: false,
      name: null,
    });
  });

  it('does not trust a string "true": only the boolean counts as verified', async () => {
    const { http } = scriptedFetch(
      json({ access_token: 'at' }),
      json({ sub: '9', email: 'a@b.com', email_verified: 'true' }),
    );

    // The malformed field fails parsing rather than being coerced to verified.
    await expect(new GoogleOAuthProvider(config, http).exchangeCode('c')).rejects.toThrow();
  });

  it('rejects when Google refuses the code', async () => {
    const { http } = scriptedFetch(json({ error: 'invalid_grant' }, 400));
    await expect(new GoogleOAuthProvider(config, http).exchangeCode('bad')).rejects.toThrow(/400/);
  });

  it('rejects a token response with no access token', async () => {
    const { http } = scriptedFetch(json({ token_type: 'Bearer' }));
    await expect(new GoogleOAuthProvider(config, http).exchangeCode('c')).rejects.toThrow();
  });

  it('rejects when userinfo fails or returns no subject', async () => {
    const failed = scriptedFetch(json({ access_token: 'at' }), json({}, 401));
    await expect(new GoogleOAuthProvider(config, failed.http).exchangeCode('c')).rejects.toThrow(/401/);

    const noSub = scriptedFetch(json({ access_token: 'at' }), json({ email: 'a@b.com' }));
    await expect(new GoogleOAuthProvider(config, noSub.http).exchangeCode('c')).rejects.toThrow();
  });
});

describe('readCookie', () => {
  it('finds the nonce among other cookies', () => {
    expect(readCookie(`a=1; ${OAUTH_NONCE_COOKIE}=abc_-123; b=2`, OAUTH_NONCE_COOKIE)).toBe('abc_-123');
  });

  it('is undefined when absent, empty, or malformed', () => {
    expect(readCookie(undefined, OAUTH_NONCE_COOKIE)).toBeUndefined();
    expect(readCookie('a=1', OAUTH_NONCE_COOKIE)).toBeUndefined();
    expect(readCookie('garbage', OAUTH_NONCE_COOKIE)).toBeUndefined();
    expect(readCookie(`${OAUTH_NONCE_COOKIE}=%E0%A4%A`, OAUTH_NONCE_COOKIE)).toBeUndefined();
  });

  it('does not match a cookie whose name merely ends the same way', () => {
    expect(readCookie(`x${OAUTH_NONCE_COOKIE}=evil`, OAUTH_NONCE_COOKIE)).toBeUndefined();
  });
});
