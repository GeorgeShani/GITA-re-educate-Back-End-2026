export const STAGES = ['accounts', 'content'] as const;
export type Stage = (typeof STAGES)[number];

export const DEFAULT_CREDENTIALS_PATH = '.seed-credentials.local.json';

export interface ShowcaseArgs {
  stage: Stage;
  /** Your own Gmail address, without a `+` part: every seeded login is a plus-address of it. */
  mailbox: string;
  confirmProduction: boolean;
  /** The live API, including its `/api` prefix. Only the content stage talks to it. */
  api: string | null;
  credentialsPath: string;
  /** Skip the questions put to the AI assistant (they are skipped on their own when the server has it switched off). */
  skipAi: boolean;
}

export const USAGE = [
  'Usage:',
  '  node --env-file=.env.production.local dist/seeds/showcase/seed-showcase.js --stage accounts --mailbox you@gmail.com --confirm-production',
  '  node --env-file=.env.production.local dist/seeds/showcase/seed-showcase.js --stage content --mailbox you@gmail.com --api https://your.domain/api',
  '',
  'Options:',
  '  --stage accounts|content   accounts: create the 3 companies and their admins (Free). content: add employees and upload data.',
  '  --mailbox <address>        Your Gmail. People become you+northwind-nino@gmail.com and so on, all delivered to you.',
  '  --confirm-production       Required by the accounts stage when NODE_ENV=production.',
  '  --api <url>                The live API, e.g. https://gridline.example.com/api (content stage).',
  `  --credentials <path>       Where passwords are kept (default ${DEFAULT_CREDENTIALS_PATH}). Never commit it.`,
  '  --skip-ai                  Do not ask the AI assistant any questions.',
].join('\n');

/** Reads `--name value` and `--flag`; throws with a sentence on anything it does not understand, so a typo never seeds the wrong thing. */
export function parseArgs(argv: readonly string[]): ShowcaseArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueOptions = ['stage', 'mailbox', 'api', 'credentials'];
  const flagOptions = ['confirm-production', 'skip-ai'];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? '';
    if (!token.startsWith('--')) throw new Error(`Unexpected argument "${token}".`);
    const name = token.slice(2);
    if (flagOptions.includes(name)) {
      flags.add(name);
    } else if (valueOptions.includes(name)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value.`);
      values.set(name, value);
      index += 1;
    } else {
      throw new Error(`Unknown option "${token}".`);
    }
  }

  const stage = values.get('stage');
  if (!stage || !STAGES.includes(stage as Stage)) throw new Error(`--stage must be one of: ${STAGES.join(', ')}.`);
  const mailbox = values.get('mailbox');
  if (!mailbox) throw new Error('--mailbox is required (your own Gmail address).');
  const api = values.get('api')?.replace(/\/+$/, '') ?? null;
  if (stage === 'content') {
    if (!api) throw new Error('--api is required for the content stage, e.g. --api https://your.domain/api');
    if (!/^https?:\/\//.test(api)) throw new Error('--api must start with http:// or https://');
  }

  return {
    stage: stage as Stage,
    mailbox,
    confirmProduction: flags.has('confirm-production'),
    api,
    credentialsPath: values.get('credentials') ?? DEFAULT_CREDENTIALS_PATH,
    skipAi: flags.has('skip-ai'),
  };
}
