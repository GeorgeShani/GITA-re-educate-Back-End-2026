import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { describe, expect, it } from 'vitest';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { RolesGuard } from '#/common/auth/roles.guard.js';
import { ScopesGuard } from '#/common/auth/scopes.guard.js';
import { DemoReadOnlyGuard } from '#/demo/demo-read-only.guard.js';
import { isGraphql, requestOf, responseOf } from './request-of.js';

class Resolver {
  @Roles('admin')
  adminOnly(): void {}

  @Roles('admin')
  @RequireScopes('files:read')
  scoped(): void {}
}

const admin = { userId: 'u', companyId: 'c', role: 'admin', authMethod: 'jwt', isDemo: false } as const;
const employee = { ...admin, role: 'employee' } as const;
const demoAdmin = { ...admin, isDemo: true } as const;
const key = { ...admin, authMethod: 'api_key', scopes: ['files:read'] } as const;

/** What Nest hands a resolver: `[root, args, context, info]`, typed 'graphql'. */
function graphqlContext(method: keyof Resolver, user: object | undefined, httpMethod = 'POST') {
  const req = { user, method: httpMethod, headers: {} };
  const res = { marker: 'res' };
  const host = new ExecutionContextHost([{}, {}, { req, res }, {}], Resolver, Reflect.get(Resolver.prototype, method));
  host.setType('graphql');
  return { host, req, res };
}

function httpContext(method: keyof Resolver, user: object | undefined) {
  const req = { user, method: 'GET' };
  const res = { marker: 'res' };
  return { host: new ExecutionContextHost([req, res], Resolver, Reflect.get(Resolver.prototype, method)), req, res };
}

describe('requestOf / responseOf', () => {
  it('finds the request in the GraphQL context, not in the resolver’s root object', () => {
    const { host, req, res } = graphqlContext('adminOnly', admin);
    expect(isGraphql(host)).toBe(true);
    expect(requestOf(host)).toBe(req);
    expect(responseOf(host)).toBe(res);
  });

  it('finds it where it always was over HTTP', () => {
    const { host, req, res } = httpContext('adminOnly', admin);
    expect(isGraphql(host)).toBe(false);
    expect(requestOf(host)).toBe(req);
    expect(responseOf(host)).toBe(res);
  });
});

/** The point of the helper: the guards must judge a GraphQL request as they judge an HTTP one. */
describe('the global guards over GraphQL', () => {
  const roles = new RolesGuard(new Reflector());
  const scopes = new ScopesGuard(new Reflector());
  const demo = new DemoReadOnlyGuard();

  it('RolesGuard enforces @Roles (it would see "no user" and refuse everyone if it read the root object)', () => {
    expect(roles.canActivate(graphqlContext('adminOnly', admin).host)).toBe(true);
    expect(roles.canActivate(graphqlContext('adminOnly', employee).host)).toBe(false);
    expect(roles.canActivate(graphqlContext('adminOnly', undefined).host)).toBe(false);
  });

  it('ScopesGuard still denies an API key on a resolver with no scope, and honours one that declares it', () => {
    expect(() => scopes.canActivate(graphqlContext('adminOnly', key).host)).toThrow(/API keys cannot be used/);
    expect(scopes.canActivate(graphqlContext('scoped', key).host)).toBe(true);
    expect(scopes.canActivate(graphqlContext('adminOnly', admin).host)).toBe(true);
  });

  it('DemoReadOnlyGuard lets a demo user READ over GraphQL (a POST) — the schema has nothing to write', () => {
    expect(demo.canActivate(graphqlContext('adminOnly', demoAdmin, 'POST').host)).toBe(true);
    // …while the same user over REST POST is refused.
    expect(() => demo.canActivate(postOf(demoAdmin))).toThrow();
  });
});

function postOf(user: object) {
  const req = { user, method: 'POST' };
  return new ExecutionContextHost([req, {}], Resolver, Resolver.prototype.adminOnly);
}
