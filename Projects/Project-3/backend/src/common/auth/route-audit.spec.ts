import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { DECORATORS } from '@nestjs/swagger';
import { describe, expect, it, vi } from 'vitest';

// `AppModule` reads config while its decorator evaluates, so the Tier-1 keys
// must exist before the import below runs. `vi.hoisted` runs ahead of imports.
vi.hoisted(() => {
  const defaults = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/gridline',
    DIRECT_URL: 'postgres://u:p@localhost:5432/gridline',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };
  for (const [key, value] of Object.entries(defaults)) {
    process.env[key] ??= value;
  }
});

import { AppModule } from '#/app.module.js';
import { ENTITIES } from '#/database/entities.js';
import { HealthController } from '#/health/health.controller.js';
import { REQUIRED_SCOPES_KEY, type ApiScope } from './require-scopes.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * Project-2's best test, inverted. Project-2 had no `@Public()` — auth was
 * opt-in per controller via `@UseGuards`, so its `rbac.integration.spec.ts`
 * existed to prove every ADMIN route remembered to gate itself. Gridline
 * inverts the model (opt-out via `@Public()`, once the global guard lands in
 * Milestone 3), so the risk inverts too: the failure mode isn't "forgot to
 * add a guard", it's "forgot to annotate a route at all", which would leave
 * it silently un-audited rather than silently open. This spec is what turns
 * that from a review habit into something that fails a build.
 *
 * Controllers are DISCOVERED by walking `AppModule`'s import graph, not listed
 * by hand: a hand-kept list is a second thing to remember, and forgetting to
 * add a new controller to it silently exempts that controller from every
 * check below. A module that isn't imported anywhere isn't reachable, so it
 * isn't a route either.
 */
type ControllerClass = new (...args: never[]) => unknown;

function isControllerClass(value: unknown): value is ControllerClass {
  return typeof value === 'function';
}

/** A `DynamicModule` (`forRoot()` etc.) is `{ module, controllers?, imports? }`. */
function isDynamicModule(value: unknown): value is {
  module: ControllerClass;
  controllers?: unknown;
  imports?: unknown;
} {
  return typeof value === 'object' && value !== null && 'module' in value;
}

function collectControllers(
  moduleRef: unknown,
  seen: Set<unknown> = new Set(),
): ControllerClass[] {
  if (seen.has(moduleRef)) return [];
  seen.add(moduleRef);

  let moduleClass: ControllerClass;
  let dynamicControllers: unknown[] = [];
  let dynamicImports: unknown[] = [];

  if (isDynamicModule(moduleRef)) {
    moduleClass = moduleRef.module;
    dynamicControllers = isArray(moduleRef.controllers) ? moduleRef.controllers : [];
    dynamicImports = isArray(moduleRef.imports) ? moduleRef.imports : [];
  } else if (isControllerClass(moduleRef)) {
    moduleClass = moduleRef;
  } else {
    return [];
  }

  const ownControllers: unknown = Reflect.getMetadata('controllers', moduleClass);
  const ownImports: unknown = Reflect.getMetadata('imports', moduleClass);

  const controllers = [
    ...(isArray(ownControllers) ? ownControllers : []),
    ...dynamicControllers,
  ].filter(isControllerClass);

  const nested = [...(isArray(ownImports) ? ownImports : []), ...dynamicImports].flatMap(
    (imported) => collectControllers(imported, seen),
  );

  return [...controllers, ...nested];
}

const AUDITED_CONTROLLERS = [...new Set(collectControllers(AppModule))];

/**
 * `HealthController`'s response is Terminus's own dynamic `HealthCheckResult`
 * — an operational detail, not a domain response worth a DTO — so it's
 * exempt from the "response type is a DTO, not an entity" check by name,
 * exactly as its own doc comment says `route-audit.spec.ts` does.
 */
const EXEMPT_FROM_RESPONSE_TYPE_CHECK = new Set<string>([HealthController.name]);

interface RouteHandle {
  controller: string;
  controllerClass: ControllerClass;
  method: string;
  handler: () => unknown;
}

/**
 * Metadata as the guards resolve it: the route's own value wins, else the
 * controller's (`Reflector.getAllAndOverride`). Reading the handler alone would
 * mis-flag a controller that puts `@Roles('admin')` on the class.
 */
function metadataOf(key: string, route: RouteHandle): unknown {
  const onHandler: unknown = Reflect.getMetadata(key, route.handler);
  return onHandler !== undefined ? onHandler : Reflect.getMetadata(key, route.controllerClass);
}

function routesOf(ControllerClass: new (...args: never[]) => unknown): RouteHandle[] {
  // Object.getOwnPropertyNames and Reflect.get both accept `any`, so neither
  // needs `ControllerClass.prototype` cast to a concrete shape — a cast was
  // the previous approach here and is exactly what's banned. Reflect.get's
  // own return type is `any`; declaring `value` as `unknown` is what stops
  // that `any` from spreading, same pattern as everywhere else in this repo
  // that touches a loosely-typed reflection API.
  const propertyNames = Object.getOwnPropertyNames(ControllerClass.prototype).filter(
    (name) => name !== 'constructor',
  );

  const handlers: RouteHandle[] = [];
  for (const name of propertyNames) {
    const value: unknown = Reflect.get(ControllerClass.prototype, name);
    if (isRouteHandler(value)) {
      handlers.push({
        controller: ControllerClass.name,
        controllerClass: ControllerClass,
        method: name,
        handler: value,
      });
    }
  }
  return handlers;
}

/** Only Nest route handlers carry PATH_METADATA — plain methods don't. */
function isRouteHandler(value: unknown): value is (() => unknown) & { name: string } {
  return typeof value === 'function' && Reflect.hasMetadata(PATH_METADATA, value);
}

/**
 * `lib.es2015.core.d.ts` types `Array.isArray` as `(arg: any) => arg is any[]`
 * — using it directly would narrow `unknown` to `any[]`, reintroducing
 * exactly the implicit `any` the rest of this codebase avoids explicitly.
 * This shadows it with a real `unknown[]` predicate.
 */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Narrows to a class reference without asserting — any `function` typeof qualifies. */
function isConstructorFunction(value: unknown): value is new () => object {
  return typeof value === 'function';
}

function isEntityClass(value: unknown): boolean {
  return isConstructorFunction(value) && ENTITIES.includes(value);
}

describe('route audit', () => {
  const routes = AUDITED_CONTROLLERS.flatMap(routesOf);

  it('found at least one route to audit', () => {
    // A refactor that renames every handler shouldn't let this spec pass
    // vacuously over zero routes.
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.map((route) => [`${route.controller}.${route.method}`, route] as const))(
    '%s is @Public() XOR carries @Roles()',
    (_label, route) => {
      const isPublic: boolean = metadataOf(IS_PUBLIC_KEY, route) === true;
      const roles: unknown = metadataOf(ROLES_KEY, route);
      const hasRoles = roles !== undefined;

      // Neither -> silently un-annotated, the exact bug this spec exists to
      // catch. Both -> contradictory (why would a public route need a role
      // check?) and almost certainly a copy-paste mistake.
      expect(
        isPublic !== hasRoles,
        `${route.controller}.${route.method} must be @Public() or @Roles(), not both or neither`,
      ).toBe(true);
    },
  );

  it.each(routes.map((route) => [`${route.controller}.${route.method}`, route] as const))(
    '%s has a non-empty PATH_METADATA / METHOD_METADATA registration',
    (_label, route) => {
      // Sanity check on the discovery mechanism itself: if Nest ever changes
      // how it stamps route metadata, this fails loudly here instead of the
      // other two checks passing vacuously.
      expect(Reflect.getMetadata(PATH_METADATA, route.handler)).toBeDefined();
      expect(Reflect.getMetadata(METHOD_METADATA, route.handler)).toBeDefined();
    },
  );

  it('every @Roles() array actually used anywhere is non-empty', () => {
    for (const route of routes) {
      const roles: unknown = metadataOf(ROLES_KEY, route);
      if (roles === undefined) continue;

      expect(isArray(roles)).toBe(true);
      if (!isArray(roles)) continue;

      expect(
        roles.length,
        `${route.controller}.${route.method} carries an empty @Roles() — omit it entirely instead`,
      ).toBeGreaterThan(0);
    }
  });

  it('every @RequireScopes() value is a recognised ApiScope', () => {
    const validScopes: ApiScope[] = ['files:read', 'files:write', 'billing:read'];

    for (const route of routes) {
      const scopes: unknown = metadataOf(REQUIRED_SCOPES_KEY, route);
      if (scopes === undefined) continue;

      expect(isArray(scopes)).toBe(true);
      if (!isArray(scopes)) continue;

      for (const scope of scopes) {
        expect(validScopes).toContain(scope);
      }
    }
  });

  it('every audited controller carries exactly one @ApiTags', () => {
    for (const ControllerClass of AUDITED_CONTROLLERS) {
      const tags: unknown = Reflect.getMetadata(DECORATORS.API_TAGS, ControllerClass);

      expect(isArray(tags), `${ControllerClass.name} has no @ApiTags`).toBe(true);
      if (!isArray(tags)) continue;

      expect(
        tags.length,
        `${ControllerClass.name} must carry exactly one @ApiTags, found ${tags.length}`,
      ).toBe(1);
    }
  });

  it("every route's @ApiOkResponse/@ApiCreatedResponse type is a DTO, not an entity", () => {
    for (const route of routes) {
      if (EXEMPT_FROM_RESPONSE_TYPE_CHECK.has(route.controller)) continue;

      const responses: unknown = Reflect.getMetadata(DECORATORS.API_RESPONSE, route.handler);

      expect(
        isRecord(responses),
        `${route.controller}.${route.method} has no @ApiOkResponse/@ApiCreatedResponse`,
      ).toBe(true);
      if (!isRecord(responses)) continue;

      const entries = Object.values(responses).filter(isRecord);
      const typedEntries = entries.filter((entry) => 'type' in entry);

      expect(
        typedEntries.length,
        `${route.controller}.${route.method}'s @ApiResponse declares no \`type\``,
      ).toBeGreaterThan(0);

      for (const entry of typedEntries) {
        expect(
          isEntityClass(entry.type),
          `${route.controller}.${route.method} must respond with a DTO, not an entity class`,
        ).toBe(false);
      }
    }
  });
});
