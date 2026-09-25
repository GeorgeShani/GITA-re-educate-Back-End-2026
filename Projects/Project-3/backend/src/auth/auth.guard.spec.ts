import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AllowWhenSuspended } from '#/common/auth/allow-when-suspended.decorator.js';
import { Public } from '#/common/auth/public.decorator.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { AuthGuard } from './auth.guard.js';
import { ApiKeyAuthenticationService } from './api-key-authentication.service.js';
import { AuthenticationService } from './authentication.service.js';

class Routes {
  normal(): void {}

  @AllowWhenSuspended()
  billing(): void {}

  @Public()
  open(): void {}
}

const USER = { userId: 'u1', companyId: 'c1', role: 'admin', authMethod: 'jwt', isDemo: false } as const;
const KEY_USER = {
  userId: 'u2',
  companyId: 'c1',
  role: 'employee',
  authMethod: 'api_key',
  isDemo: false,
  scopes: ['files:read'],
  apiKeyId: 'k1',
} as const;
const VALID_KEY = `gl_live_ab12cd34_${'A'.repeat(43)}`;

function requestWith(authorization: string | undefined) {
  return { headers: { authorization }, user: undefined };
}

async function setup(companyStatus: 'active' | 'suspended') {
  const authenticated: unknown[] = [];
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthGuard,
      Reflector,
      {
        provide: AuthenticationService,
        useValue: { authenticate: async () => ({ user: USER, companyStatus }) },
      },
      {
        provide: ApiKeyAuthenticationService,
        useValue: { authenticate: async () => ({ user: KEY_USER, companyStatus }) },
      },
      {
        provide: RequestContextService,
        useValue: { setAuthenticated: (user: unknown) => authenticated.push(user) },
      },
    ],
  }).compile();

  const run = (method: 'normal' | 'billing' | 'open', authorization: string | undefined) => {
    const request = requestWith(authorization);
    const context = new ExecutionContextHost([request], Routes, Reflect.get(Routes.prototype, method));
    return { result: moduleRef.get(AuthGuard).canActivate(context), request };
  };
  return { run, authenticated };
}

describe('AuthGuard', () => {
  it('requires a bearer token on a normal route', async () => {
    const { run } = await setup('active');

    await expect(run('normal', undefined).result).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(run('normal', 'Basic abc').result).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('skips a @Public() route without looking for a token', async () => {
    const { run, authenticated } = await setup('active');

    expect(await run('open', undefined).result).toBe(true);
    expect(authenticated).toEqual([]);
  });

  it('authenticates, sets request.user and the request context', async () => {
    const { run, authenticated } = await setup('active');
    const { result, request } = run('normal', 'Bearer abc');

    expect(await result).toBe(true);
    expect(request.user).toEqual(USER);
    expect(authenticated).toEqual([USER]);
  });

  describe('API keys', () => {
    it('routes a gl_live_ bearer to the API-key authenticator, and anything else to the JWT one', async () => {
      const { run } = await setup('active');

      const viaKey = run('normal', `Bearer ${VALID_KEY}`);
      await viaKey.result;
      expect(viaKey.request.user).toEqual(KEY_USER);

      const viaJwt = run('normal', 'Bearer eyJhbGciOi.payload.sig');
      await viaJwt.result;
      expect(viaJwt.request.user).toEqual(USER);
    });

    it('puts the key in the request context, so audit entries can name it', async () => {
      const { run, authenticated } = await setup('active');

      await run('normal', `Bearer ${VALID_KEY}`).result;
      expect(authenticated).toEqual([KEY_USER]);
    });

    it('applies the suspended-company rule to key requests too', async () => {
      const { run } = await setup('suspended');

      await expect(run('normal', `Bearer ${VALID_KEY}`).result).rejects.toBeInstanceOf(ForbiddenException);
      expect(await run('billing', `Bearer ${VALID_KEY}`).result).toBe(true);
    });
  });

  describe('a suspended company', () => {
    it('is refused on an ordinary route', async () => {
      const { run, authenticated } = await setup('suspended');

      await expect(run('normal', 'Bearer abc').result).rejects.toBeInstanceOf(ForbiddenException);
      expect(authenticated).toEqual([]);
    });

    it('is let through on a route marked @AllowWhenSuspended()', async () => {
      const { run, authenticated } = await setup('suspended');

      expect(await run('billing', 'Bearer abc').result).toBe(true);
      expect(authenticated).toEqual([USER]);
    });
  });
});
