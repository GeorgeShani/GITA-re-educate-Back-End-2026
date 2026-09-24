import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { OAUTH_REGISTRATION_TTL_SECONDS, OAUTH_STATE_TTL_SECONDS } from '../auth.constants.js';
import type { OAuthProfile } from './oauth-provider.js';

const nonce = z.string().min(16).max(64);

/**
 * What survives the round trip through the provider. Signed, so it is a server
 * session without a server session: nothing is stored, nothing can be forged.
 * The invite is named by its hash — the plaintext never leaves the emailed link
 * and the request body, so it does not end up in Google's logs or the URL bar.
 */
const stateSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.enum(['login', 'register']), nonce }),
  z.object({ intent: z.literal('invite'), nonce, inviteTokenHash: z.string().min(1) }),
  z.object({ intent: z.literal('link'), nonce, userId: z.uuid() }),
]);
export type OAuthState = z.infer<typeof stateSchema>;

const registrationSchema = z.object({
  sub: z.string().min(1),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  name: z.string().nullable(),
});
export type OAuthRegistrationClaims = z.infer<typeof registrationSchema>;

const STATE_AUDIENCE = 'gridline:oauth-state';
const REGISTRATION_AUDIENCE = 'gridline:oauth-registration';

/**
 * Signs and verifies the two short-lived tokens the Google flow uses. Each purpose
 * gets its OWN key (HMAC-derived from the access secret) and audience, so neither
 * can be replayed as the other, and neither is ever accepted as an access token
 * — or the reverse. `iat` comes from the injected clock, like every other token.
 */
@Injectable()
export class OAuthStateService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** A fresh CSRF nonce. It goes in the state AND in an httpOnly cookie; the callback needs both to agree. */
  newNonce(): string {
    return randomBytes(24).toString('base64url');
  }

  signState(state: OAuthState): Promise<string> {
    return this.sign(state, STATE_AUDIENCE, OAUTH_STATE_TTL_SECONDS);
  }

  async verifyState(token: string): Promise<OAuthState | null> {
    const claims = await this.verify(token, STATE_AUDIENCE);
    const parsed = stateSchema.safeParse(claims);
    return parsed.success ? parsed.data : null;
  }

  signRegistration(profile: OAuthProfile): Promise<string> {
    const claims: OAuthRegistrationClaims = {
      sub: profile.providerUserId,
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
    };
    return this.sign(claims, REGISTRATION_AUDIENCE, OAUTH_REGISTRATION_TTL_SECONDS);
  }

  async verifyRegistration(token: string): Promise<OAuthRegistrationClaims | null> {
    const parsed = registrationSchema.safeParse(await this.verify(token, REGISTRATION_AUDIENCE));
    return parsed.success ? parsed.data : null;
  }

  /** Constant-time comparison of the state's nonce with the cookie's. */
  static nonceMatches(fromState: string, fromCookie: string | undefined): boolean {
    if (!fromCookie) return false;
    const a = Buffer.from(fromState);
    const b = Buffer.from(fromCookie);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private sign(claims: object, audience: string, ttlSeconds: number): Promise<string> {
    return this.jwt.signAsync(
      { ...claims, iat: Math.floor(this.clock.now().getTime() / 1000) },
      { secret: this.keyFor(audience), algorithm: 'HS256', audience, expiresIn: ttlSeconds },
    );
  }

  private async verify(token: string, audience: string): Promise<unknown> {
    try {
      const payload: unknown = await this.jwt.verifyAsync(token, {
        secret: this.keyFor(audience),
        algorithms: ['HS256'],
        audience,
        clockTimestamp: Math.floor(this.clock.now().getTime() / 1000),
      });
      return payload;
    } catch {
      return null;
    }
  }

  private keyFor(audience: string): Buffer {
    return createHmac('sha256', this.config.JWT_ACCESS_SECRET).update(audience).digest();
  }
}
