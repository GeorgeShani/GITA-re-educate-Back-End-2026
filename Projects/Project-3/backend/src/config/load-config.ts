import { type AppConfig, envSchema } from './env.schema.js';

/**
 * Parses and freezes the environment into one typed object.
 *
 * Deliberately a *pure function over a record*, not a Nest provider: the Nest
 * factory and the standalone migration runner both need the same parsed config,
 * and the runner has no injector. One parser here means there is exactly one
 * answer to "which database did migrations run against".
 *
 * Throws with every offending key listed at once — a boot failure should tell
 * you everything wrong with the file, not just the first thing.
 *
 * Takes `Record<string, unknown>` — wider than `NodeJS.ProcessEnv` — on
 * purpose: Zod's `safeParse` accepts `unknown` regardless, and this is what
 * lets `@nestjs/config`'s `validate` hook (typed to receive exactly
 * `Record<string, unknown>`) call this directly with no cast at the call site.
 */
export function loadConfig(
  source: Record<string, unknown> = process.env,
): AppConfig {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => {
        const key = issue.path.join('.') || '(root)';
        return `  ${key}: ${issue.message}`;
      })
      .sort()
      .join('\n');

    throw new Error(
      `Invalid environment configuration:\n${problems}\n\n` +
        'See backend/.env.example for every key and its graded default.',
    );
  }

  return Object.freeze(result.data);
}

/** Injection token for the parsed config. Feature code never sees ConfigService. */
export const APP_CONFIG = Symbol('APP_CONFIG');
