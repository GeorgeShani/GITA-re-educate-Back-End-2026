import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, type EntityManager } from 'typeorm';
import { z } from 'zod';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { isUniqueViolation, uniqueViolationConstraint } from '#/database/pg-errors.js';
import { OAUTH_EXCHANGE_TOKEN_TTL_MS } from '../auth.constants.js';
import { AuthTokenService } from '../auth-token.service.js';
import { type Session, SessionService } from '../session.service.js';
import type { PublicOAuthIntent } from './dto/google-url.dto.js';
import { GOOGLE_OAUTH, type OAuthProfile, type OAuthProvider } from './oauth-provider.js';
import {
  type EmailCandidate,
  type OAuthErrorCode,
  mayDiscoverByEmail,
  resolveOAuth,
} from './oauth-resolution.js';
import { type OAuthState, OAuthStateService } from './oauth-state.service.js';
import { contactFromProfile } from './relay-address.js';

/** Where the browser lands. The Next app owns these pages; the API only builds the links. */
const SESSION_PAGE = '/session/oauth-complete';
const REGISTER_PAGE = '/register';
const LINK_PAGE = '/settings/linked-accounts';

const INVALID_INVITE = 'This invitation is invalid or has expired. Ask your admin to send a new one.';
const NOT_CONFIGURED = 'Google sign-in is not configured on this server.';

/** What the callback controller does with the browser. */
export interface OAuthCallbackResult {
  redirect: string;
}

export interface OAuthStart {
  url: string;
  /** Also set as an httpOnly cookie; the callback requires the cookie to match the state. */
  nonce: string;
}

/** Google adds `scope`, `authuser`, `prompt`, `hd`… — a browser navigation, so tolerate them all. */
const callbackQuery = z.looseObject({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

interface ClientMeta {
  userAgent: string | undefined;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(GOOGLE_OAUTH) private readonly google: OAuthProvider | null,
    private readonly states: OAuthStateService,
    private readonly authTokens: AuthTokenService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly logger: PinoLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.logger.setContext(OAuthService.name);
  }

  /** The authorization URL for a signed-out flow (`login`, `register`, or an invite). */
  async start(input: { intent: PublicOAuthIntent; inviteToken?: string }): Promise<OAuthStart> {
    const google = this.requireGoogle();
    const nonce = this.states.newNonce();

    if (input.intent !== 'invite') {
      return this.begin(google, { intent: input.intent, nonce });
    }

    // Refuse a dead invite link now, rather than after a trip to Google.
    if (!input.inviteToken) throw new BadRequestException(INVALID_INVITE);
    const inviteToken = input.inviteToken;
    const userId = await this.authTokens.peek(this.dataSource.manager, 'invite', inviteToken);
    const invitee = userId
      ? await this.dataSource.manager.findOne(User, {
          where: { id: userId },
          relations: { company: true },
        })
      : null;
    if (!invitee || invitee.status !== 'invited' || invitee.company?.status !== 'active') {
      throw new BadRequestException(INVALID_INVITE);
    }

    return this.begin(google, {
      intent: 'invite',
      nonce,
      inviteTokenHash: this.authTokens.hashOf(inviteToken),
    });
  }

  /** The authorization URL for "Link Google" — the state names the signed-in user. */
  startLink(userId: string): Promise<OAuthStart> {
    const google = this.requireGoogle();
    return this.begin(google, { intent: 'link', nonce: this.states.newNonce(), userId });
  }

  /**
   * The provider redirected the browser back here. Every outcome — success or
   * refusal — is a redirect to the frontend, never a JSON error: a person is
   * looking at this page. Tokens never appear in the URL; a success carries a
   * 60-second single-use `code` the BFF trades for a session.
   */
  async handleCallback(rawQuery: unknown, cookieNonce: string | undefined): Promise<OAuthCallbackResult> {
    const google = this.requireGoogle();

    const query = callbackQuery.safeParse(rawQuery);
    const state = query.success && query.data.state ? await this.states.verifyState(query.data.state) : null;
    // The state proves *we* started this; the cookie proves *this browser* did.
    // Without the cookie, an attacker could feed a victim's browser their own
    // callback and sign the victim into the attacker's account.
    if (!query.success || !state || !OAuthStateService.nonceMatches(state.nonce, cookieNonce)) {
      return this.refused('invalid_state', SESSION_PAGE);
    }

    const page = state.intent === 'link' ? LINK_PAGE : SESSION_PAGE;
    if (query.data.error) {
      return this.refused(query.data.error === 'access_denied' ? 'access_denied' : 'provider_error', page);
    }
    if (!query.data.code) return this.refused('provider_error', page);

    let profile: OAuthProfile;
    try {
      profile = await google.exchangeCode(query.data.code);
    } catch (error) {
      this.logger.warn({ err: error }, 'Google code exchange failed');
      return this.refused('provider_error', page);
    }

    const known = await this.dataSource.manager.findOne(AuthIdentity, {
      where: { provider: google.provider, providerUserId: profile.providerUserId },
    });
    const emailCandidates = mayDiscoverByEmail(state.intent, profile) && !known
      ? await this.activeUsersWithContactEmail(contactFromProfile(profile).email)
      : [];

    const resolution = resolveOAuth({
      intent: state.intent,
      stateUserId: state.intent === 'link' ? state.userId : null,
      knownIdentityUserId: known?.userId ?? null,
      profile,
      emailCandidates,
    });

    switch (resolution.kind) {
      case 'refuse':
        return this.refused(resolution.reason, page);
      case 'register':
        return { redirect: this.frontend(REGISTER_PAGE, { oauthRegistration: await this.states.signRegistration(profile) }) };
      case 'sign_in':
        return this.signIn(resolution.userId, profile, resolution.viaEmail);
      case 'link':
        return this.link(resolution.userId, profile, resolution.alreadyLinked);
      case 'bind_invite':
        return state.intent === 'invite'
          ? this.bindInvite(state, profile)
          : this.refused('invalid_state', page);
    }
  }

  /** Trades the callback's code for a session. The code is single-use and lives 60 seconds. */
  async exchange(code: string, meta: ClientMeta): Promise<Session> {
    return this.dataSource.transaction(async (manager) => {
      const userId = await this.authTokens.consume(manager, 'oauth_exchange', code);
      const user = userId
        ? await manager.findOne(User, { where: { id: userId }, relations: { company: true } })
        : null;
      // Re-checked, not assumed: the account may have been disabled in the last minute.
      if (!user || user.status !== 'active' || user.company?.status !== 'active') {
        throw new UnauthorizedException('Invalid or expired code');
      }
      return this.sessions.startSession(manager, user.id, randomUUID(), meta);
    });
  }

  private async begin(google: OAuthProvider, state: OAuthState): Promise<OAuthStart> {
    return { url: google.authorizationUrl(await this.states.signState(state)), nonce: state.nonce };
  }

  private requireGoogle(): OAuthProvider {
    if (!this.google) throw new ServiceUnavailableException(NOT_CONFIGURED);
    return this.google;
  }

  private async activeUsersWithContactEmail(email: string | null): Promise<EmailCandidate[]> {
    if (!email) return [];
    // Two rows are enough to know it is ambiguous.
    const users = await this.dataSource.manager
      .createQueryBuilder(User, 'u')
      .innerJoinAndSelect('u.company', 'company')
      .where('lower(u.email) = :email AND u.status = :status', { email, status: 'active' })
      .take(2)
      .getMany();
    return users.map((user) => ({ userId: user.id, companyActive: user.company?.status === 'active' }));
  }

  private async signIn(userId: string, profile: OAuthProfile, viaEmail: boolean): Promise<OAuthCallbackResult> {
    const user = await this.dataSource.manager.findOne(User, {
      where: { id: userId },
      relations: { company: true },
    });
    if (!user?.company) return this.refused('account_unavailable', SESSION_PAGE);
    if (user.status === 'invited' || user.company.status === 'pending_activation') {
      return this.refused('not_activated', SESSION_PAGE);
    }
    if (user.status !== 'active' || user.company.status !== 'active') {
      return this.refused('account_unavailable', SESSION_PAGE);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const now = this.clock.now();
        if (viaEmail) {
          await manager.insert(AuthIdentity, this.googleIdentity(user.id, profile, now));
          await this.audit.record(
            {
              action: 'auth.identity_linked',
              companyId: user.companyId,
              actorUserId: user.id,
              target: { type: 'user', id: user.id },
              metadata: { provider: 'google', via: 'verified_email_match' },
            },
            manager,
          );
        } else {
          await manager.update(
            AuthIdentity,
            { provider: 'google', providerUserId: profile.providerUserId },
            { lastUsedAt: now, email: profile.email, emailVerified: profile.emailVerified },
          );
        }
        return { redirect: await this.successRedirect(manager, user.id) };
      });
    } catch (error) {
      return this.refusedOnUniqueViolation(error, SESSION_PAGE);
    }
  }

  private async link(userId: string, profile: OAuthProfile, alreadyLinked: boolean): Promise<OAuthCallbackResult> {
    const user = await this.dataSource.manager.findOne(User, {
      where: { id: userId },
      relations: { company: true },
    });
    // The person who started this may have been removed while they were at Google.
    if (!user || user.status !== 'active' || user.company?.status !== 'active') {
      return this.refused('account_unavailable', LINK_PAGE);
    }
    if (alreadyLinked) return { redirect: this.frontend(LINK_PAGE, { linked: 'google' }) };

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.insert(AuthIdentity, this.googleIdentity(user.id, profile, this.clock.now()));
        await this.audit.record(
          {
            action: 'auth.identity_linked',
            companyId: user.companyId,
            actorUserId: user.id,
            target: { type: 'user', id: user.id },
            metadata: { provider: 'google', via: 'settings' },
          },
          manager,
        );
      });
    } catch (error) {
      return this.refusedOnUniqueViolation(error, LINK_PAGE);
    }
    return { redirect: this.frontend(LINK_PAGE, { linked: 'google' }) };
  }

  /**
   * The invite link already proved who this is, so whatever Google account comes
   * back is bound to the invited user with NO email comparison — a relay address,
   * a personal Gmail and an unrelated one are all fine. This is the moment billing
   * starts, exactly as for a password acceptance.
   */
  private async bindInvite(
    state: Extract<OAuthState, { intent: 'invite' }>,
    profile: OAuthProfile,
  ): Promise<OAuthCallbackResult> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const userId = await this.authTokens.consumeByHash(manager, 'invite', state.inviteTokenHash);
        const user = userId
          ? await manager.findOne(User, { where: { id: userId }, relations: { company: true } })
          : null;
        if (!user || user.status !== 'invited' || user.company?.status !== 'active') {
          return this.refused('invalid_invite', SESSION_PAGE);
        }

        const now = this.clock.now();
        await manager.update(User, { id: user.id }, { status: 'active', activatedAt: now, disabledAt: null });
        await manager.insert(AuthIdentity, this.googleIdentity(user.id, profile, now));
        if (user.role === 'employee') {
          await manager.insert(SeatInterval, {
            companyId: user.companyId,
            userId: user.id,
            activeFrom: now,
            activeTo: null,
          });
        }
        await this.audit.record(
          {
            action: 'employee.accepted_invite',
            companyId: user.companyId,
            actorUserId: user.id,
            target: { type: 'user', id: user.id },
            metadata: { provider: 'google' },
          },
          manager,
        );
        return { redirect: await this.successRedirect(manager, user.id) };
      });
    } catch (error) {
      // The transaction rolled back, so the invitation is still unspent.
      return this.refusedOnUniqueViolation(error, SESSION_PAGE);
    }
  }

  private googleIdentity(userId: string, profile: OAuthProfile, now: Date) {
    return {
      userId,
      provider: 'google' as const,
      providerUserId: profile.providerUserId,
      email: profile.email,
      emailVerified: profile.emailVerified,
      passwordHash: null,
      lastUsedAt: now,
    };
  }

  private async successRedirect(manager: EntityManager, userId: string): Promise<string> {
    const code = await this.authTokens.issue(manager, userId, 'oauth_exchange', OAUTH_EXCHANGE_TOKEN_TTL_MS);
    return this.frontend(SESSION_PAGE, { code });
  }

  private refusedOnUniqueViolation(error: unknown, page: string): OAuthCallbackResult {
    if (!isUniqueViolation(error)) throw error;
    // Two constraints can trip: this Google account belongs to someone else, or
    // this user already has a (different) Google account.
    return this.refused(
      uniqueViolationConstraint(error) === 'uq_auth_identity_user_provider' ? 'already_linked' : 'identity_in_use',
      page,
    );
  }

  private refused(reason: OAuthErrorCode, page: string): OAuthCallbackResult {
    return { redirect: this.frontend(page, { error: reason }) };
  }

  private frontend(path: string, params: Record<string, string>): string {
    const url = new URL(path, this.config.APP_PUBLIC_URL);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }
}
