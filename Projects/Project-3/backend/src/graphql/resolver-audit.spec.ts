import 'reflect-metadata';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '#/common/auth/public.decorator.js';
import { REQUIRED_SCOPES_KEY } from '#/common/auth/require-scopes.decorator.js';
import { ROLES_KEY } from '#/common/auth/roles.decorator.js';
import { GraphqlApiModule } from './graphql-api.module.js';

const here = dirname(fileURLToPath(import.meta.url));

type ResolverClass = new (...args: never[]) => object;

function isClass(value: unknown): value is ResolverClass {
  return typeof value === 'function' && 'prototype' in value;
}

/** Every class exported from a `*.resolver.ts` beside this file — found on disk, so a new one cannot be forgotten. */
async function resolverClasses(): Promise<Array<{ name: string; type: ResolverClass }>> {
  const files = (await readdir(here)).filter((file) => file.endsWith('.resolver.ts'));
  const found: Array<{ name: string; type: ResolverClass }> = [];
  for (const file of files) {
    const module: Record<string, unknown> = await import(join(here, file));
    for (const [name, value] of Object.entries(module)) {
      if (isClass(value)) found.push({ name, type: value });
    }
  }
  return found;
}

/**
 * The route-audit spec covers controllers; resolvers are a second door into the same data, so
 * they get the same enforcement. The guards are global and run for GraphQL too — this pins the
 * annotations they act on.
 */
describe('GraphQL resolvers', () => {
  it('there is at least one, so the checks below are not vacuous', async () => {
    expect((await resolverClasses()).length).toBeGreaterThan(0);
  });

  it('every resolver is signed-in only: @Roles, never @Public', async () => {
    for (const { name, type } of await resolverClasses()) {
      const roles: unknown = Reflect.getMetadata(ROLES_KEY, type);
      expect(Array.isArray(roles) && roles.length > 0, `${name} needs @Roles(...)`).toBe(true);
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, type), `${name} must not be @Public()`).toBeUndefined();
    }
  });

  it('none declares @RequireScopes: an API key cannot reach the GraphQL surface at all', async () => {
    for (const { name, type } of await resolverClasses()) {
      expect(Reflect.getMetadata(REQUIRED_SCOPES_KEY, type), `${name} must not accept API keys`).toBeUndefined();
      for (const method of Object.getOwnPropertyNames(type.prototype)) {
        const handler: unknown = Reflect.get(type.prototype, method);
        if (typeof handler === 'function') {
          expect(Reflect.getMetadata(REQUIRED_SCOPES_KEY, handler), `${name}.${method}`).toBeUndefined();
        }
      }
    }
  });

  it('every resolver is registered in GraphqlApiModule (an unregistered one would be silently absent)', async () => {
    const providers: unknown = Reflect.getMetadata('providers', GraphqlApiModule);
    for (const { name, type } of await resolverClasses()) {
      expect(Array.isArray(providers) && providers.includes(type), `${name} is not a provider`).toBe(true);
    }
  });
});
