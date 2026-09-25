import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from './authenticated-user.interface.js';
import { type ApiScope, RequireScopes } from './require-scopes.decorator.js';
import { ScopesGuard } from './scopes.guard.js';

class Routes {
  unmarked(): void {}

  @RequireScopes('files:read')
  read(): void {}

  @RequireScopes('files:read', 'files:write')
  both(): void {}
}

@RequireScopes('files:read')
class ClassLevel {
  inherits(): void {}

  @RequireScopes('files:write')
  overrides(): void {}
}

const SESSION: AuthenticatedUser = { userId: 'u', companyId: 'c', role: 'admin', authMethod: 'jwt', isDemo: false };
const key = (...scopes: ApiScope[]): AuthenticatedUser => ({
  userId: 'u',
  companyId: 'c',
  role: 'employee',
  authMethod: 'api_key',
  isDemo: false,
  scopes,
  apiKeyId: 'k',
});

function decide(user: AuthenticatedUser | undefined, controller: new () => object, method: string): boolean {
  const context = new ExecutionContextHost([{ user }], controller, Reflect.get(controller.prototype, method));
  return new ScopesGuard(new Reflector()).canActivate(context);
}

describe('ScopesGuard', () => {
  it('leaves sessions alone, whatever the route declares', () => {
    expect(decide(SESSION, Routes, 'unmarked')).toBe(true);
    expect(decide(SESSION, Routes, 'both')).toBe(true);
  });

  it('leaves public routes alone (there is no user)', () => {
    expect(decide(undefined, Routes, 'unmarked')).toBe(true);
  });

  it('DENIES a key on a route that declares no scope (default deny)', () => {
    expect(() => decide(key('files:read', 'files:write', 'billing:read'), Routes, 'unmarked')).toThrow(
      ForbiddenException,
    );
  });

  it('allows a key holding the declared scope, and refuses one that does not', () => {
    expect(decide(key('files:read'), Routes, 'read')).toBe(true);
    expect(() => decide(key('files:write'), Routes, 'read')).toThrow(/files:read/);
    expect(() => decide(key(), Routes, 'read')).toThrow(ForbiddenException);
  });

  it('requires EVERY declared scope, not any', () => {
    expect(() => decide(key('files:read'), Routes, 'both')).toThrow(/files:write/);
    expect(decide(key('files:read', 'files:write'), Routes, 'both')).toBe(true);
  });

  it('reads a class-level declaration, which a handler-level one overrides', () => {
    expect(decide(key('files:read'), ClassLevel, 'inherits')).toBe(true);
    expect(() => decide(key('files:read'), ClassLevel, 'overrides')).toThrow(ForbiddenException);
    expect(decide(key('files:write'), ClassLevel, 'overrides')).toBe(true);
  });
});
