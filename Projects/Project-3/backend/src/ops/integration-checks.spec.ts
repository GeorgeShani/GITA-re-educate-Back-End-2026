import { describe, expect, it } from 'vitest';
import {
  type Check,
  exitCodeFor,
  expectedGoogleCallbackUrl,
  expectedStripeWebhookUrl,
  fail,
  formatReport,
  googleRefusalReason,
  pass,
  runChecks,
  scrub,
  skip,
  stripeKeyMode,
} from './integration-checks.js';

const check = (name: string, run: Check['run']): Check => ({ name, run });

describe('runChecks', () => {
  it('reports each check in order, with what it said', async () => {
    const outcomes = await runChecks([
      check('one', async () => pass('fine')),
      check('two', async () => skip('switched off')),
      check('three', async () => fail('nope')),
    ]);

    expect(outcomes.map(({ name, status, detail }) => ({ name, status, detail }))).toEqual([
      { name: 'one', status: 'pass', detail: 'fine' },
      { name: 'two', status: 'skip', detail: 'switched off' },
      { name: 'three', status: 'fail', detail: 'nope' },
    ]);
  });

  it('turns a check that throws into a failure and carries on with the rest', async () => {
    const outcomes = await runChecks([
      check('breaks', async () => {
        throw new Error('connect ECONNREFUSED');
      }),
      check('after', async () => pass('still ran')),
    ]);

    expect(outcomes[0]).toMatchObject({ status: 'fail', detail: 'connect ECONNREFUSED' });
    expect(outcomes[1]).toMatchObject({ status: 'pass' });
  });

  it('gives a check that never answers a deadline instead of hanging the report', async () => {
    const outcomes = await runChecks([check('hangs', () => new Promise<never>(() => {}))], 20);

    expect(outcomes[0]).toMatchObject({ status: 'fail' });
    expect(outcomes[0]?.detail).toContain('no answer');
  });

  it('masks anything shaped like a secret in what it prints', async () => {
    const outcomes = await runChecks([
      check('leaky', async () => {
        throw new Error('Invalid API Key provided: sk_live_51Habc123XYZ and whsec_abcdef123456 with Bearer abc.def.ghi');
      }),
    ]);

    expect(outcomes[0]?.detail).not.toMatch(/51Habc123XYZ|abcdef123456|abc\.def\.ghi/);
    expect(outcomes[0]?.detail).toContain('sk_live_…');
  });
});

describe('the exit code', () => {
  it('is 1 when anything failed, and 0 when everything passed or was switched off', async () => {
    expect(exitCodeFor(await runChecks([check('a', async () => pass('ok')), check('b', async () => skip('off'))]))).toBe(0);
    expect(exitCodeFor(await runChecks([check('a', async () => pass('ok')), check('b', async () => fail('bad'))]))).toBe(1);
  });
});

describe('formatReport', () => {
  it('prints one line per check and a count', async () => {
    const report = formatReport(await runChecks([check('Postgres', async () => pass('ok')), check('S3', async () => fail('403'))]));

    expect(report).toMatch(/PASS {2}Postgres/);
    expect(report).toMatch(/FAIL {2}S3 {8}403/); // names are padded to the longest, then two spaces
    expect(report).toContain('1 passed, 1 failed, 0 skipped');
  });
});

describe('what the services must be told', () => {
  it('derives the webhook and Google callback addresses from the public URL, with or without a trailing slash', () => {
    expect(expectedStripeWebhookUrl('https://app.example.com')).toBe('https://app.example.com/api/webhooks/stripe');
    expect(expectedStripeWebhookUrl('https://app.example.com/')).toBe('https://app.example.com/api/webhooks/stripe');
    expect(expectedGoogleCallbackUrl('https://app.example.com/')).toBe('https://app.example.com/api/auth/google/callback');
  });

  it('reads the Stripe mode from the key', () => {
    expect(stripeKeyMode('sk_test_abc')).toBe('test');
    expect(stripeKeyMode('rk_live_abc')).toBe('live');
    expect(stripeKeyMode('pk_test_abc')).toBeNull();
    expect(stripeKeyMode('whsec_abc')).toBeNull();
  });

  it('explains why Google refused, and says nothing when it sent the browser on to sign in', () => {
    expect(googleRefusalReason(302, '')).toBeNull();
    expect(googleRefusalReason(400, 'Error 400: redirect_uri_mismatch')).toContain('Authorized redirect URIs');
    expect(googleRefusalReason(401, 'Error 401: invalid_client')).toContain('GOOGLE_CLIENT_ID');
    expect(googleRefusalReason(500, 'oops')).toBe('Google answered 500');
  });

  it('scrubs a client secret out of a URL', () => {
    expect(scrub('POST https://x/token?client_secret=GOCSPX-abcd&code=1')).toBe('POST https://x/token?client_secret=…&code=1');
  });
});
