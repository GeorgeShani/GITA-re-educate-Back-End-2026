import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { isUniqueViolation } from '#/database/pg-errors.js';
import { appLink } from '../app-link.js';
import { ACTIVATION_TOKEN_TTL_MS } from '../auth.constants.js';
import { AuthTokenService } from '../auth-token.service.js';
import { type Session, SessionService } from '../session.service.js';
import type { OAuthRegisterCompanyDto } from './dto/oauth-registration.dto.js';
import { type OAuthRegistrationClaims, OAuthStateService } from './oauth-state.service.js';
import { contactFromProfile } from './relay-address.js';

const BAD_TOKEN =
  'This Google registration has expired. Start again with "Continue with Google".';

export interface OAuthRegistrationPreview {
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface OAuthRegistered {
  companyId: string;
  userId: string;
  status: 'pending_activation' | 'active';
  session: Session | null;
}

/**
 * Company registration where Google is the credential. The provider email
 * prefills the form and, if VERIFIED and not a relay address, is the contact
 * address and skips the activation email — Google already proved the mailbox.
 * Country and industry are still collected. Otherwise it behaves exactly like a
 * password registration: an activation email to the address the person typed.
 */
@Injectable()
export class OAuthRegistrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly states: OAuthStateService,
    private readonly authTokens: AuthTokenService,
    private readonly sessions: SessionService,
    private readonly queue: TaskQueue,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async preview(token: string): Promise<OAuthRegistrationPreview> {
    const claims = await this.claimsOf(token);
    const contact = contactFromProfile({ email: claims.email, emailVerified: claims.emailVerified });
    return { email: contact.email, emailVerified: contact.verified, name: claims.name };
  }

  async register(
    dto: OAuthRegisterCompanyDto,
    meta: { userAgent: string | undefined },
  ): Promise<OAuthRegistered> {
    const claims = await this.claimsOf(dto.oauthRegistrationToken);
    const contact = contactFromProfile({ email: claims.email, emailVerified: claims.emailVerified });

    // A vouched-for address is THE contact address; letting the form substitute
    // another would skip the activation email for a mailbox nobody proved.
    if (contact.verified && dto.email !== undefined && dto.email !== contact.email) {
      throw new BadRequestException(
        'Your Google account already vouches for its email address; leave `email` out or use the same one.',
      );
    }
    const email = contact.verified ? contact.email : dto.email;
    if (!email) {
      throw new BadRequestException(
        'Google did not give us an address we can use — provide `email` so we can send an activation link.',
      );
    }
    const verified = contact.verified;

    try {
      return await this.dataSource.transaction(async (manager) => {
        const now = this.clock.now();

        const company = await manager.save(
          manager.create(Company, {
            name: dto.companyName,
            billingEmail: email,
            country: dto.country,
            industry: dto.industry,
            status: verified ? 'active' : 'pending_activation',
            activatedAt: verified ? now : null,
          }),
        );
        const user = await manager.save(
          manager.create(User, {
            companyId: company.id,
            email,
            fullName: claims.name?.trim() || (email.split('@')[0] ?? email),
            role: 'admin',
            status: verified ? 'active' : 'invited',
            activatedAt: verified ? now : null,
            disabledAt: null,
          }),
        );
        await manager.insert(AuthIdentity, {
          userId: user.id,
          provider: 'google',
          providerUserId: claims.sub,
          email: claims.email,
          emailVerified: claims.emailVerified,
          passwordHash: null,
          lastUsedAt: verified ? now : null,
        });

        if (!verified) {
          const activation = await this.authTokens.issue(manager, user.id, 'activation', ACTIVATION_TOKEN_TTL_MS);
          await this.queue.enqueue(
            'send_email',
            {
              template: 'activation',
              to: email,
              vars: {
                companyName: company.name,
                activationUrl: appLink(this.config.APP_PUBLIC_URL, '/activate', activation),
              },
            },
            { manager },
          );
        }

        await this.audit.record(
          {
            action: 'company.registered',
            companyId: company.id,
            actorUserId: user.id,
            target: { type: 'company', id: company.id },
            metadata: { industry: company.industry, country: company.country, provider: 'google' },
          },
          manager,
        );
        if (verified) {
          await this.audit.record(
            {
              action: 'company.activated',
              companyId: company.id,
              actorUserId: user.id,
              target: { type: 'company', id: company.id },
              metadata: { via: 'verified_provider_email' },
            },
            manager,
          );
        }

        const session = verified ? await this.sessions.startSession(manager, user.id, randomUUID(), meta) : null;
        return {
          companyId: company.id,
          userId: user.id,
          status: verified ? 'active' : 'pending_activation',
          session,
        };
      });
    } catch (error) {
      // `billingEmail` is unique, and so is `(provider, providerUserId)`; the
      // constraints, not a pre-check, are what is race-proof.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email address already exists, or this Google account is already registered. Try signing in with Google.',
        );
      }
      throw error;
    }
  }

  private async claimsOf(token: string): Promise<OAuthRegistrationClaims> {
    const claims = await this.states.verifyRegistration(token);
    if (!claims) throw new BadRequestException(BAD_TOKEN);
    return claims;
  }
}
