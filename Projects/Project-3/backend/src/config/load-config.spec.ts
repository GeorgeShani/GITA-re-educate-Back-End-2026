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

    expect(() => loadConfig(env)).toThrow(/DATABASE_URL/);
  });

  it('rejects a too-short signing secret rather than accepting a weak one', () => {
    expect(() => loadConfig(validEnv({ JWT_ACCESS_SECRET: 'short' }))).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('reports every problem at once, not just the first', () => {
    const env = validEnv();
    delete env.DATABASE_URL;
    delete env.JWT_REFRESH_SECRET;

    const run = () => loadConfig(env);
    expect(run).toThrow(/DATABASE_URL/);
    expect(run).toThrow(/JWT_REFRESH_SECRET/);
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
    expect(() => loadConfig(validEnv({ TRUST_PROXY: '-1' }))).toThrow(/TRUST_PROXY/);
    expect(() => loadConfig(validEnv({ TRUST_PROXY: 'yes' }))).toThrow(/TRUST_PROXY/);
  });

  it('returns a frozen object so nothing can mutate config at runtime', () => {
    expect(Object.isFrozen(loadConfig(validEnv()))).toBe(true);
  });

  it('keeps payments disabled by default outside production', () => {
    const config = loadConfig(validEnv());

    expect(config.PAYMENTS_PROVIDER).toBe('none');
    expect(config.ALLOW_UNPAID_PLANS).toBe(false);
    expect(config.STRIPE_DUNNING_GRACE_DAYS).toBe(7);
  });

  it('requires the complete Stripe catalog when Stripe is enabled', () => {
    expect(() => loadConfig(validEnv({ PAYMENTS_PROVIDER: 'stripe' }))).toThrow(
      /STRIPE_SECRET_KEY/,
    );
  });

  it('refuses unsafe production defaults', () => {
    const production = validEnv({
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'production-access-secret-that-is-long-enough',
      JWT_REFRESH_SECRET: 'production-refresh-secret-that-is-long-enough',
    });

    expect(() => loadConfig(production)).toThrow(/MAIL_TRANSPORT/);
    expect(() =>
      loadConfig({
        ...production,
        MAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
      }),
    ).toThrow(/APP_PUBLIC_URL/);
  });

  it('allows an explicit unpaid production deployment override', () => {
    const config = loadConfig(
      validEnv({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'production-access-secret-that-is-long-enough',
        JWT_REFRESH_SECRET: 'production-refresh-secret-that-is-long-enough',
        MAIL_TRANSPORT: 'smtp',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        APP_PUBLIC_URL: 'https://gridline.example.com',
        ALLOW_UNPAID_PLANS: 'true',
      }),
    );

    expect(config.ALLOW_UNPAID_PLANS).toBe(true);
  });
});
