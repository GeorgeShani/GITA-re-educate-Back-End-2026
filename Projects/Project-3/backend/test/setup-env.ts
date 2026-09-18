// Integration specs call loadConfig() with no arguments (defaulting to
// process.env), same as the real app — but unlike main.ts/data-source.ts,
// nothing runs before Vitest starts to put .env into process.env. This is
// that step, isolated to the integration config: unit tests build their own
// env objects explicitly and must not depend on a real .env existing.
import '../src/load-env.js';
