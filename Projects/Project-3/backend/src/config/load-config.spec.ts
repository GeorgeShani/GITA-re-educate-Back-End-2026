import { describe, expect, it } from 'vitest';
import { loadConfig } from './load-config.js';

/** The minimum a valid environment must carry — the Tier 1 keys. */
function validEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: 'postgres://u:p@localhost:5432/gridline',
    DIRECT_URL: 'postgres://u:p@localhost:5432/gridline',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    ...overrides,
  };
}

describe('loadConfig', () => {
  it('applies schema defaults so read sites never duplicate them', () => {
    const config = loadConfig(validEnv());

    expect(config.PORT).toBe(4000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.STORAGE_DRIVER).toBe('s3');
    expect(config.MAIL_TRANSPORT).toBe('console');
    expect(config.AI_PROVIDER).toBe('off');
  });

  it('coerces numeric strings, because env vars are always strings', () => {
    expect(loadConfig(validEnv({ PORT: '4100' })).PORT).toBe(4100);
  });

  it('treats an empty optional key as absent', () => {
    // .env.example ships keys present but unset (`AWS_REGION=`) and dotenv
    // yields '' — a copied example file must not fail boot.
    const config = loadConfig(
      validEnv({ AWS_REGION: '', GEMINI_API_KEY: '', GIT_SHA: '' }),
    );

    expect(config.AWS_REGION).toBeUndefined();
    expect(config.GEMINI_API_KEY).toBeUndefined();
  });

  it('fails when a Tier 1 key is missing, naming the key', () => {
    const env = validEnv();
    delete env.DATABASE_URL;

    expect(() => loadConfig(env)).toThrowError(/DATABASE_URL/);
  });

  it('rejects a too-short signing secret rather than accepting a weak one', () => {
    expect(() => loadConfig(validEnv({ JWT_ACCESS_SECRET: 'short' }))).toThrowError(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('reports every problem at once, not just the first', () => {
    const env = validEnv();
    delete env.DATABASE_URL;
    delete env.JWT_REFRESH_SECRET;

    const run = () => loadConfig(env);
    expect(run).toThrowError(/DATABASE_URL/);
    expect(run).toThrowError(/JWT_REFRESH_SECRET/);
  });

  it('enables telemetry only when BOTH credential halves are present', () => {
    // The SDK does not no-op on partial credentials; it flushes and gets 401s.
    expect(loadConfig(validEnv()).observeEnabled).toBe(false);
    expect(
      loadConfig(validEnv({ OBSERVE_APP_KEY: 'key' })).observeEnabled,
    ).toBe(false);
    expect(
      loadConfig(validEnv({ OBSERVE_APP_KEY: 'key', OBSERVE_APP_SECRET: 's' }))
        .observeEnabled,
    ).toBe(true);
  });

  it('splits CORS_ORIGIN into a list and drops blanks', () => {
    const config = loadConfig(
      validEnv({ CORS_ORIGIN: 'http://a.test, http://b.test ,' }),
    );

    expect(config.corsOrigins).toEqual(['http://a.test', 'http://b.test']);
  });

  it('rate limiting is ON unless explicitly switched off', () => {
    expect(loadConfig(validEnv()).RATE_LIMIT_ENABLED).toBe(true);
    expect(loadConfig(validEnv({ RATE_LIMIT_ENABLED: '' })).RATE_LIMIT_ENABLED).toBe(true);
    expect(loadConfig(validEnv({ RATE_LIMIT_ENABLED: 'true' })).RATE_LIMIT_ENABLED).toBe(true);
    for (const off of ['false', '0', 'off', 'FALSE']) {
      expect(loadConfig(validEnv({ RATE_LIMIT_ENABLED: off })).RATE_LIMIT_ENABLED).toBe(false);
    }
  });

  it('trusts no proxy by default, and a bounded number of hops when told to', () => {
    expect(loadConfig(validEnv()).TRUST_PROXY).toBe(0);
    expect(loadConfig(validEnv({ TRUST_PROXY: '1' })).TRUST_PROXY).toBe(1);
    expect(() => loadConfig(validEnv({ TRUST_PROXY: '-1' }))).toThrowError(/TRUST_PROXY/);
    expect(() => loadConfig(validEnv({ TRUST_PROXY: 'yes' }))).toThrowError(/TRUST_PROXY/);
  });

  it('returns a frozen object so nothing can mutate config at runtime', () => {
    expect(Object.isFrozen(loadConfig(validEnv()))).toBe(true);
  });
});
