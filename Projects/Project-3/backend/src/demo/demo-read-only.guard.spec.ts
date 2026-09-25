import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '#/common/auth/authenticated-user.interface.js';
import { DEMO_READ_ONLY_MESSAGE, DemoReadOnlyGuard } from './demo-read-only.guard.js';

function user(isDemo: boolean, authMethod: 'jwt' | 'api_key' = 'jwt'): AuthenticatedUser {
  return { userId: 'u', companyId: 'c', role: 'admin', authMethod, isDemo };
}

function decide(method: string, who: AuthenticatedUser | undefined): boolean {
  class Routes {
    handler(): void {}
  }
  const context = new ExecutionContextHost([{ method, user: who }], Routes, Routes.prototype.handler);
  return new DemoReadOnlyGuard().canActivate(context);
}

describe('DemoReadOnlyGuard', () => {
  it.each(['POST', 'PATCH', 'PUT', 'DELETE', 'post'])('refuses %s for a demo user, with the reason', (method) => {
    expect(() => decide(method, user(true))).toThrow(ForbiddenException);
    expect(() => decide(method, user(true))).toThrow(DEMO_READ_ONLY_MESSAGE);
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('lets a demo user %s', (method) => {
    expect(decide(method, user(true))).toBe(true);
  });

  it('refuses writes made with an API key of a demo company too', () => {
    expect(() => decide('POST', user(true, 'api_key'))).toThrow(ForbiddenException);
  });

  it('never touches an ordinary company, or a request with no user (public routes)', () => {
    expect(decide('POST', user(false))).toBe(true);
    expect(decide('DELETE', undefined)).toBe(true);
  });
});
