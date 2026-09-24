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
import { AuthenticationService } from './authentication.service.js';

class Routes {
  normal(): void {}

  @AllowWhenSuspended()
  billing(): void {}

  @Public()
  open(): void {}
}

const USER = { userId: 'u1', companyId: 'c1', role: 'admin' } as const;

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
