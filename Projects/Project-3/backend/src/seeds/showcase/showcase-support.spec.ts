import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Api, ApiError } from './api-client.js';
import { DEFAULT_CREDENTIALS_PATH, parseArgs } from './args.js';
import { Credentials, generatePassword } from './credentials.js';
import { addressFor, billingAddressFor } from './plan.js';

describe('parseArgs', () => {
  it('reads the accounts stage', () => {
    expect(parseArgs(['--stage', 'accounts', '--mailbox', 'me@gmail.com', '--confirm-production'])).toEqual({
      stage: 'accounts',
      mailbox: 'me@gmail.com',
      confirmProduction: true,
      api: null,
      credentialsPath: DEFAULT_CREDENTIALS_PATH,
      skipAi: false,
    });
  });

  it('reads the content stage and tidies the API address', () => {
    const args = parseArgs(['--stage', 'content', '--mailbox', 'me@gmail.com', '--api', 'https://gridline.example.com/api/', '--skip-ai']);
    expect(args).toMatchObject({ stage: 'content', api: 'https://gridline.example.com/api', skipAi: true, confirmProduction: false });
  });

  it.each([
    [[], /--stage/],
    [['--stage', 'everything', '--mailbox', 'a@b.c'], /--stage/],
    [['--stage', 'accounts'], /--mailbox/],
    [['--stage', 'content', '--mailbox', 'a@b.c'], /--api/],
    [['--stage', 'content', '--mailbox', 'a@b.c', '--api', 'gridline.example.com'], /http/],
    [['--stage', 'accounts', '--mailbox'], /needs a value/],
    [['--stage', 'accounts', '--mailbox', 'a@b.c', '--confirm'], /Unknown option/],
    [['accounts'], /Unexpected argument/],
  ])('refuses %j', (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message);
  });
});

describe('the plus-addresses', () => {
  it('give each person a distinct login that reaches one mailbox', () => {
    expect(addressFor('you@gmail.com', 'northwind', 'Nino Beridze')).toBe('you+northwind-nino@gmail.com');
    expect(billingAddressFor('you@gmail.com', 'meridian')).toBe('you+meridian-billing@gmail.com');
  });

  it('keep letters and digits only from a first name', () => {
    expect(addressFor('you@gmail.com', 'kavkasia', "Ke-te'van Maisuradze")).toBe('you+kavkasia-ketevan@gmail.com');
  });

  it('refuse a mailbox that already has a "+" part, or is not an address', () => {
    expect(() => addressFor('you+a@gmail.com', 'x', 'Y')).toThrow(/plain address/);
    expect(() => addressFor('nonsense', 'x', 'Y')).toThrow(/plain address/);
  });
});

describe('generatePassword', () => {
  it('is 20 characters with every kind, and different each time', () => {
    const seen = new Set<string>();
    for (let index = 0; index < 50; index += 1) {
      const password = generatePassword();
      seen.add(password);
      expect(password).toHaveLength(20);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!#$%*+\-=?@^_]/);
      expect(password).not.toMatch(/[0OIl1]/);
    }
    expect(seen.size).toBe(50);
  });
});

describe('Credentials', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'gridline-credentials-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const company = { slug: 'northwind', name: 'Northwind Logistics', billingEmail: 'you+northwind-billing@gmail.com', plan: 'basic' };
  const nino = { role: 'admin' as const, fullName: 'Nino Beridze', email: 'you+northwind-nino@gmail.com' };

  it('keeps a password it made, across runs, and writes both files private to the owner', async () => {
    const path = join(dir, 'creds.json');
    const first = await (await Credentials.open(path, 'you@gmail.com')).person(company, nino);
    const again = await (await Credentials.open(path, 'you@gmail.com')).person(company, nino);

    expect(again.password).toBe(first.password);
    const markdown = await readFile(join(dir, 'creds.md'), 'utf8');
    expect(markdown).toContain(first.password);
    expect(markdown).toContain('Northwind Logistics');
    expect((await stat(path)).mode & 0o077).toBe(0);
  });

  it('refuses a file made for another mailbox', async () => {
    const path = join(dir, 'creds.json');
    await (await Credentials.open(path, 'you@gmail.com')).person(company, nino);
    await expect(Credentials.open(path, 'someone@gmail.com')).rejects.toThrow(/you@gmail.com/);
  });

  it('remembers what is done', async () => {
    const path = join(dir, 'creds.json');
    const credentials = await Credentials.open(path, 'you@gmail.com');
    expect(credentials.isDone('northwind:ask:0')).toBe(false);
    await credentials.markDone('northwind:ask:0');
    expect((await Credentials.open(path, 'you@gmail.com')).isDone('northwind:ask:0')).toBe(true);
  });
});

describe('Api', () => {
  const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  const tokens = { accessToken: 'a1', refreshToken: 'r1', tokenType: 'Bearer', expiresIn: 900 };

  it('spaces sign-ins so a long run stays under the limit', async () => {
    const waits: number[] = [];
    const api = new Api('https://x.test/api', { fetch: async () => json(200, tokens), sleep: async (ms) => void waits.push(ms), signInGapMs: 6_500 });
    await api.signIn('a@x.test', 'pw');
    await api.signIn('b@x.test', 'pw');
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(6_000);
  });

  it('waits and tries again when told to slow down, and when the server is briefly away', async () => {
    const answers = [json(429, { message: 'slow' }, { 'retry-after': '3' }), json(503, 'down'), json(200, { ok: true })];
    const waits: number[] = [];
    const api = new Api('https://x.test/api', { fetch: async () => answers.shift() ?? json(500, 'empty'), sleep: async (ms) => void waits.push(ms) });

    await expect(api.send('GET', '/files')).resolves.toEqual({ ok: true });
    expect(waits[0]).toBe(3_000);
    expect(waits).toHaveLength(2);
  });

  it('does not retry a refusal, and says what the server said', async () => {
    let calls = 0;
    const api = new Api('https://x.test/api', { fetch: async () => (calls += 1, json(409, { message: 'all 10 seats are taken' })), sleep: async () => undefined });
    const error = await api.send('POST', '/employees', { json: {} }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toMatch(/409.*seats are taken/);
    expect(calls).toBe(1);
  });

  it('refreshes an expired token and repeats the request once', async () => {
    const seen: string[] = [];
    const api = new Api('https://x.test/api', {
      sleep: async () => undefined,
      signInGapMs: 0,
      fetch: async (url, init) => {
        const path = String(url).replace('https://x.test/api', '');
        const auth = new Headers(init?.headers).get('authorization');
        seen.push(`${path} ${auth ?? '-'}`);
        if (path === '/auth/login') return json(200, tokens);
        if (path === '/auth/refresh') return json(200, { ...tokens, accessToken: 'a2' });
        return auth === 'Bearer a2' ? json(200, { fine: true }) : json(401, { message: 'expired' });
      },
    });
    const session = await api.signIn('a@x.test', 'pw');
    await expect(session.get('/files')).resolves.toEqual({ fine: true });
    expect(seen).toEqual(['/auth/login -', '/files Bearer a1', '/auth/refresh -', '/files Bearer a2']);
  });

  it('uploads one multipart body with repeated grant fields and a stable idempotency key across retries', async () => {
    const keys: string[] = [];
    const bodies: FormData[] = [];
    const answers = [429, 201];
    const api = new Api('https://x.test/api', {
      sleep: async () => undefined,
      signInGapMs: 0,
      fetch: async (url, init) => {
        if (String(url).endsWith('/auth/login')) return json(200, tokens);
        keys.push(new Headers(init?.headers).get('idempotency-key') ?? '');
        bodies.push(init?.body as FormData);
        return json(answers.shift() ?? 500, { id: 'f1' });
      },
    });
    const session = await api.signIn('a@x.test', 'pw');
    await session.upload('/files', { bytes: Buffer.from('a,b\n1,2\n'), name: 'x.csv', mime: 'text/csv', fields: { visibility: 'restricted', grantedUserIds: ['u1', 'u2'] } });

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
    const form = bodies[1];
    expect(form?.getAll('grantedUserIds')).toEqual(['u1', 'u2']);
    expect(form?.get('visibility')).toBe('restricted');
    expect((form?.get('file') as File | null)?.name).toBe('x.csv');
  });
});
