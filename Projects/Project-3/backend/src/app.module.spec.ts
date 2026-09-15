import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Asserts decorator-time conditional wiring by reading module metadata, rather
 * than by booting the app. `observeImports()` runs when `@Module` is evaluated,
 * so each case needs a fresh module registry with different env — hence
 * `vi.resetModules()` plus a dynamic import.
 *
 * The thing being protected: `@nestjs/observe` does NOT no-op on empty
 * credentials (verified in the installed package — the credential check only
 * guards a TLS warning). It starts, flushes, and logs `Telemetry rejected (401)`
 * per flush. So a grader with no Observe account must get a build where the
 * module was never registered at all.
 */
const TIER_1_ENV = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/gridline',
  DIRECT_URL: 'postgres://u:p@localhost:5432/gridline',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

async function importAppModuleWith(
  env: Record<string, string | undefined>,
): Promise<{ imports: unknown[]; observeModuleClass: unknown }> {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...TIER_1_ENV, ...env })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const module = await import('./app.module.js');
  // Reflect.getMetadata's own type is `any`; an `unknown` binding plus
  // Array.isArray narrows it for real, rather than casting.
  const rawImports: unknown = Reflect.getMetadata('imports', module.AppModule);
  const imports = Array.isArray(rawImports) ? rawImports : [];

  return { imports, observeModuleClass: module.ObserveModule };
}

/** Type-predicate guard — `in` narrows `entry`, no assertion needed. */
function hasModuleProperty(entry: object): entry is { module: unknown } {
  return 'module' in entry;
}

/** A DynamicModule produced by `ObserveModule.forRoot()` carries `module`. */
function includesObserve(imports: unknown[], observeModuleClass: unknown) {
  return imports.some(
    (entry) =>
      entry === observeModuleClass ||
      (typeof entry === 'object' &&
        entry !== null &&
        hasModuleProperty(entry) &&
        entry.module === observeModuleClass),
  );
}

/** A class's own `.name`, whether `entry` is the class or a DynamicModule. */
function moduleNameOf(entry: unknown): string {
  if (typeof entry === 'function') return entry.name;

  if (typeof entry === 'object' && entry !== null && hasModuleProperty(entry)) {
    const inner = entry.module;
    if (typeof inner === 'function') return inner.name;
  }

  return '';
}

describe('AppModule telemetry wiring', () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.OBSERVE_APP_KEY;
    delete process.env.OBSERVE_APP_SECRET;
  });

  afterEach(() => {
    process.env = { ...original };
    vi.resetModules();
  });

  it('omits ObserveModule entirely when no credentials are set', async () => {
    const { imports, observeModuleClass } = await importAppModuleWith({});

    expect(includesObserve(imports, observeModuleClass)).toBe(false);
  });

  it('omits it when only one credential half is set', async () => {
    const { imports, observeModuleClass } = await importAppModuleWith({
      OBSERVE_APP_KEY: 'key-without-secret',
    });

    expect(includesObserve(imports, observeModuleClass)).toBe(false);
  });

  it('registers it when both halves are set', async () => {
    const { imports, observeModuleClass } = await importAppModuleWith({
      OBSERVE_APP_KEY: 'key',
      OBSERVE_APP_SECRET: 'secret',
    });

    expect(includesObserve(imports, observeModuleClass)).toBe(true);
  });

  it('always registers the core infrastructure modules', async () => {
    const { imports } = await importAppModuleWith({});
    const names = imports.map(moduleNameOf);

    expect(names).toContain('AppConfigModule');
    expect(names).toContain('CoreModule');
    expect(names).toContain('HealthModule');
  });
});
