import { UnauthorizedException } from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import type { ClsService } from 'nestjs-cls';

import { MongoTestContext } from '../../test/support/mongo-memory-server';
import { getTestModel } from '../../test/support/test-model';
import { Role } from '@/common/enums/role.enum';
import { User, UserDocument, UserSchema } from '@/users/schemas/user.schema';
import { UsersService } from '@/users/users.service';
import { AuthService } from './auth.service';
import {
  RefreshToken,
  RefreshTokenDocument,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';

// SCOPE.md Part D priority: rotating refresh tokens with reuse detection is
// the most security-critical and most intricate thing in the auth module, and
// it had no test at all. It is also the mechanism the frontend plan flags as
// its highest-severity risk (concurrent 401s racing two refreshes revoke the
// whole session), so the exact revocation blast radius is pinned down here.
//
// Everything that touches token state runs against real Mongo — the rotation
// chain, the revokedAt bookkeeping and the multi-session sweep are all
// database behaviour, and mocking the model would test the mock.
const PASSWORD = 'correct-horse-battery';
const ACCESS_SECRET = 'test-access-secret';
const REFRESH_SECRET = 'test-refresh-secret';

interface AccessTokenClaims {
  sub: string;
  email: string;
  role: Role;
}

/** Resolves to the rejection message, failing loudly if the call succeeds. */
async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('Expected the call to reject, but it resolved');
}

describe('AuthService (integration)', () => {
  let ctx: MongoTestContext;
  let userModel: mongoose.Model<UserDocument>;
  let refreshTokenModel: mongoose.Model<RefreshTokenDocument>;
  let service: AuthService;
  let accessJwt: JwtService;
  let refreshJwt: JwtService;
  let passwordHash: string;
  let seq = 0;

  // execute() is only reached by register/recordLogin/forgot/reset/verify,
  // none of which own the behaviour under test here.
  const commandBus = {
    execute: () => Promise.resolve(undefined),
  } as unknown as CommandBus;
  const cls = { get: () => 'test-correlation-id' } as unknown as ClsService;

  beforeAll(async () => {
    ctx = await MongoTestContext.start();
    userModel = getTestModel<UserDocument>(User.name, UserSchema);
    refreshTokenModel = getTestModel<RefreshTokenDocument>(
      RefreshToken.name,
      RefreshTokenSchema,
    );

    accessJwt = new JwtService({
      secret: ACCESS_SECRET,
      signOptions: { expiresIn: '15m' },
    });
    refreshJwt = new JwtService({
      secret: REFRESH_SECRET,
      signOptions: { expiresIn: '30d' },
    });

    service = new AuthService(
      commandBus,
      new UsersService(userModel),
      accessJwt,
      refreshJwt,
      refreshTokenModel,
      cls,
    );

    // Hashed once and reused — bcrypt at the production cost factor is slow
    // enough that per-test hashing would dominate the suite's runtime.
    passwordHash = await bcrypt.hash(PASSWORD, 10);
  }, 120_000);

  afterEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.stop();
  });

  async function createUser(
    overrides: Record<string, unknown> = {},
  ): Promise<UserDocument> {
    seq += 1;
    return userModel.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: `user${seq}@example.com`,
      password: passwordHash,
      ...overrides,
    });
  }

  /** A real login, so every test starts from genuinely-issued tokens. */
  async function signIn(user: UserDocument): Promise<string> {
    const { refreshToken } = await service.login({
      email: user.email,
      password: PASSWORD,
    });
    return refreshToken;
  }

  describe('login', () => {
    it('issues an access + refresh pair for correct credentials', async () => {
      const user = await createUser();

      const result = await service.login({
        email: user.email,
        password: PASSWORD,
      });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      // The refresh token is persisted hashed, never in the clear.
      const stored = await refreshTokenModel.findOne({ userId: user._id });
      expect(stored).not.toBeNull();
      expect(stored!.tokenHash).not.toBe(result.refreshToken);
      expect(stored!.revokedAt).toBeNull();
    });

    it('rejects a wrong password', async () => {
      const user = await createUser();

      await expect(
        service.login({ email: user.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a banned account with the exact same message as a wrong password', async () => {
      const banned = await createUser({ isBanned: true });
      const normal = await createUser();

      const bannedMessage = await rejectionMessage(
        service.login({ email: banned.email, password: PASSWORD }),
      );
      const wrongPasswordMessage = await rejectionMessage(
        service.login({ email: normal.email, password: 'wrong-password' }),
      );

      // Identical text is the point — a banned account must not be
      // distinguishable from a mistyped password.
      expect(bannedMessage).toBe(wrongPasswordMessage);
      expect(bannedMessage).toBe('Invalid email or password');
    });

    it('rejects a soft-deleted account', async () => {
      const user = await createUser({ isDeleted: true });

      await expect(
        service.login({ email: user.email, password: PASSWORD }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('matches the email case-insensitively', async () => {
      const user = await createUser({ email: `mixed${++seq}@example.com` });

      await expect(
        service.login({
          email: user.email.toUpperCase(),
          password: PASSWORD,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('refresh rotation', () => {
    it('rotates the token, revokes the presented one, and links the chain', async () => {
      const user = await createUser();
      const original = await signIn(user);

      const rotated = await service.refresh(original);

      expect(rotated.refreshToken).not.toBe(original);

      const docs = await refreshTokenModel
        .find({ userId: user._id })
        .sort({ createdAt: 1 });
      expect(docs).toHaveLength(2);
      // Old one is revoked and points at its replacement.
      expect(docs[0].revokedAt).not.toBeNull();
      expect(docs[0].replacedByTokenId?.toString()).toBe(
        docs[1]._id.toString(),
      );
      // New one is live.
      expect(docs[1].revokedAt).toBeNull();
    });

    it('accepts the newly issued token for a subsequent refresh', async () => {
      const user = await createUser();
      const first = await signIn(user);

      const second = await service.refresh(first);
      await expect(service.refresh(second.refreshToken)).resolves.toBeDefined();
    });

    it('rejects a well-formed token that was never stored', async () => {
      const user = await createUser();
      const neverStored = await refreshJwt.signAsync({
        sub: user.id,
        jti: crypto.randomUUID(),
      });

      await expect(service.refresh(neverStored)).rejects.toThrow(
        /Invalid refresh token/,
      );
    });

    it('rejects a token signed with the wrong secret', async () => {
      const foreign = new JwtService({ secret: 'not-our-refresh-secret' });
      const forged = await foreign.signAsync({
        sub: new mongoose.Types.ObjectId().toString(),
        jti: crypto.randomUUID(),
      });

      await expect(service.refresh(forged)).rejects.toThrow(
        /Invalid refresh token/,
      );
    });

    it('rejects a stored token whose database expiry has passed', async () => {
      const user = await createUser();
      const token = await signIn(user);
      // JWT itself is still valid (30d), but the row has aged out — this
      // exercises the DB-side expiry check rather than JWT verification.
      await refreshTokenModel.updateOne(
        { userId: user._id },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      await expect(service.refresh(token)).rejects.toThrow(
        /Refresh token expired/,
      );
    });
  });

  describe('reuse detection', () => {
    it('rejects a token that was already rotated away', async () => {
      const user = await createUser();
      const original = await signIn(user);
      await service.refresh(original);

      await expect(service.refresh(original)).rejects.toThrow(
        /reuse detected/i,
      );
    });

    it('revokes every other live session for that user', async () => {
      const user = await createUser();
      // Three concurrent sessions — think three devices.
      const deviceA = await signIn(user);
      await signIn(user);
      await signIn(user);
      await service.refresh(deviceA); // A rotates normally

      await expect(service.refresh(deviceA)).rejects.toThrow(/reuse detected/i);

      // The blast radius is deliberately total: nothing for this user
      // survives a replay, including the sessions that did nothing wrong.
      const live = await refreshTokenModel.countDocuments({
        userId: user._id,
        revokedAt: null,
      });
      expect(live).toBe(0);
    });

    it('does not touch another user’s sessions', async () => {
      const victim = await createUser();
      const bystander = await createUser();
      const victimToken = await signIn(victim);
      await signIn(bystander);
      await service.refresh(victimToken);

      await expect(service.refresh(victimToken)).rejects.toThrow(
        /reuse detected/i,
      );

      const bystanderLive = await refreshTokenModel.countDocuments({
        userId: bystander._id,
        revokedAt: null,
      });
      expect(bystanderLive).toBe(1);
    });
  });

  describe('logout', () => {
    it('revokes only the presented session', async () => {
      const user = await createUser();
      const deviceA = await signIn(user);
      const deviceB = await signIn(user);

      await service.logout(deviceA);

      // B still works; logging out one device must not sign out the others.
      await expect(service.refresh(deviceB)).resolves.toBeDefined();
      expect(
        await refreshTokenModel.countDocuments({
          userId: user._id,
          revokedAt: null,
        }),
      ).toBe(1);
    });

    it('is silent for a token it has never seen', async () => {
      const stranger = await refreshJwt.signAsync({
        sub: new mongoose.Types.ObjectId().toString(),
        jti: crypto.randomUUID(),
      });

      await expect(service.logout(stranger)).resolves.toBeUndefined();
    });

    it('leaves a logged-out token unusable', async () => {
      const user = await createUser();
      const token = await signIn(user);
      await service.logout(token);

      // Revoked, so the next presentation reads as a replay.
      await expect(service.refresh(token)).rejects.toThrow(/reuse detected/i);
    });
  });

  describe('access token claims', () => {
    it('carries sub, email and the user’s first role', async () => {
      const user = await createUser({ roles: [Role.MANAGER, Role.CUSTOMER] });

      const { accessToken } = await service.login({
        email: user.email,
        password: PASSWORD,
      });

      const claims =
        await accessJwt.verifyAsync<AccessTokenClaims>(accessToken);
      expect(claims.sub).toBe(user.id);
      expect(claims.email).toBe(user.email);
      // Single active role — the JWT carries roles[0], not the array.
      expect(claims.role).toBe(Role.MANAGER);
    });

    it('falls back to customer when the user has no roles', async () => {
      const user = await createUser({ roles: [] });

      const { accessToken } = await service.login({
        email: user.email,
        password: PASSWORD,
      });

      const claims =
        await accessJwt.verifyAsync<AccessTokenClaims>(accessToken);
      expect(claims.role).toBe(Role.CUSTOMER);
    });
  });
});
