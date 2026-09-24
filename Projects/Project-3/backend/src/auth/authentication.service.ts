import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { z } from 'zod';
import type { AuthenticatedUser } from '../common/auth/authenticated-user.interface.js';
import { CLOCK, type Clock } from '../core/clock/clock.js';
import { User } from '../database/entities/user.entity.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants.js';

/** What a verified token claims. Parsed, not trusted: `verify` returns `any`. */
const accessTokenClaims = z.object({ sub: z.uuid() });

export interface SignedAccessToken {
  token: string;
  expiresIn: number;
}

/**
 * The one place an access token becomes an identity. HTTP's `AuthGuard` calls
 * it today; the WebSocket handshake (Phase 12) and GraphQL context (Phase 13)
 * reuse it, so "who is this?" has exactly one implementation.
 *
 * The user row is **re-read on every request**, and role, status and the
 * company's status are taken from that row — never from the token. So a
 * demotion, a disable, or a suspension takes effect on the very next request
 * instead of when the 15-minute token happens to expire. It costs one primary-
 * key lookup, which is the price of not needing a revocation list.
 */
@Injectable()
export class AuthenticationService {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async signAccessToken(userId: string): Promise<SignedAccessToken> {
    // `iat` comes from the injected clock, and jsonwebtoken derives `exp` from
    // it — so token expiry is testable with a FakeClock, not wall time.
    const iat = Math.floor(this.clock.now().getTime() / 1000);
    const token = await this.jwt.signAsync(
      { sub: userId, iat },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
    );
    return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  async authenticate(token: string): Promise<AuthenticatedUser> {
    const claims = await this.verify(token);

    const user = await this.users.findOne({
      where: { id: claims.sub },
      relations: { company: true },
    });

    // Same message for every "not you" outcome — an unknown id, a disabled
    // user and an invited-but-not-accepted one are indistinguishable.
    if (!user || user.status !== 'active' || !user.company) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    // Suspended companies are handled per-route in Phase 3 (billing stays
    // readable); until then a company must simply be active.
    if (user.company.status !== 'active') {
      throw new ForbiddenException('This company is not active');
    }

    return { userId: user.id, companyId: user.companyId, role: user.role };
  }

  private async verify(token: string): Promise<z.infer<typeof accessTokenClaims>> {
    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync(token, {
        // Pin the algorithm: never let the token pick how it is verified.
        algorithms: ['HS256'],
        clockTimestamp: Math.floor(this.clock.now().getTime() / 1000),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const parsed = accessTokenClaims.safeParse(payload);
    if (!parsed.success) throw new UnauthorizedException('Invalid or expired access token');
    return parsed.data;
  }
}
