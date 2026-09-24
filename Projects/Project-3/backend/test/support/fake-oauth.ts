import { randomUUID } from 'node:crypto';
import type { OAuthProfile, OAuthProvider } from '#/auth/oauth/oauth-provider.js';

/**
 * Stands in for Google. A spec decides who "signed in at Google" by calling
 * `issueCode(profile)` — the code is what Google would have put on the callback —
 * so no test needs a network, a browser, or a real Google account. Like the real
 * thing, a code works exactly once.
 */
export class FakeGoogleOAuthProvider implements OAuthProvider {
  readonly provider = 'google';
  private readonly pending = new Map<string, OAuthProfile>();

  authorizationUrl(state: string): string {
    return `https://accounts.google.test/auth?state=${encodeURIComponent(state)}`;
  }

  issueCode(profile: Partial<OAuthProfile> = {}): string {
    const code = `code-${randomUUID()}`;
    this.pending.set(code, {
      providerUserId: profile.providerUserId ?? `sub-${randomUUID()}`,
      email: profile.email ?? null,
      emailVerified: profile.emailVerified ?? false,
      name: profile.name ?? null,
    });
    return code;
  }

  async exchangeCode(code: string): Promise<OAuthProfile> {
    const profile = this.pending.get(code);
    if (!profile) throw new Error('invalid_grant');
    this.pending.delete(code);
    return profile;
  }

  clear(): void {
    this.pending.clear();
  }
}
