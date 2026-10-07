/**
 * The frame `npm run verify:integrations` is built on: a check is a name and something that proves one third party works, and
 * the runner turns a list of them into a report and an exit code. It knows nothing about S3 or Stripe, so it can be tested
 * without either.
 */
export type CheckStatus = 'pass' | 'fail' | 'skip';

export interface CheckResult {
  status: CheckStatus;
  detail: string;
}

export interface Check {
  name: string;
  run(): Promise<CheckResult>;
}

export interface CheckOutcome extends CheckResult {
  name: string;
  ms: number;
}

export const pass = (detail: string): CheckResult => ({ status: 'pass', detail });
export const fail = (detail: string): CheckResult => ({ status: 'fail', detail });
export const skip = (detail: string): CheckResult => ({ status: 'skip', detail });

/** Long enough for a cold TLS handshake and a slow region, short enough that one dead service does not hold up the report. */
export const CHECK_TIMEOUT_MS = 20_000;

/**
 * A report is pasted into chats and tickets, and an SDK's error can quote the key it was given ("Invalid API Key provided:
 * sk_live_…"). Anything shaped like a secret is masked before it is printed.
 */
export function scrub(text: string): string {
  return text
    .replace(/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]+/g, '$1_$2_…')
    .replace(/\bwhsec_[A-Za-z0-9]+/g, 'whsec_…')
    .replace(/\bgl_live_[A-Za-z0-9_-]+/g, 'gl_live_…')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1…')
    .replace(/(client_secret=)[^&\s]+/gi, '$1…')
    .replace(/(key=)[A-Za-z0-9_-]{16,}/gi, '$1…');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Runs the checks one after another (they are few, and a readable report beats a fast one), each against its own deadline. */
export async function runChecks(checks: readonly Check[], timeoutMs: number = CHECK_TIMEOUT_MS): Promise<CheckOutcome[]> {
  const outcomes: CheckOutcome[] = [];
  for (const check of checks) {
    const started = Date.now();
    let result: CheckResult;
    let timer: NodeJS.Timeout | undefined;
    try {
      const deadline = new Promise<CheckResult>((resolve) => {
        timer = setTimeout(() => resolve(fail(`no answer after ${Math.round(timeoutMs / 1000)} s`)), timeoutMs);
      });
      result = await Promise.race([check.run(), deadline]);
    } catch (error) {
      result = fail(messageOf(error));
    } finally {
      if (timer) clearTimeout(timer);
    }
    outcomes.push({ name: check.name, status: result.status, detail: scrub(result.detail), ms: Date.now() - started });
  }
  return outcomes;
}

const MARK: Record<CheckStatus, string> = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP' };

export function formatReport(outcomes: readonly CheckOutcome[]): string {
  const width = Math.max(0, ...outcomes.map((outcome) => outcome.name.length));
  const lines = outcomes.map(
    (outcome) => `${MARK[outcome.status]}  ${outcome.name.padEnd(width)}  ${outcome.detail} (${outcome.ms} ms)`,
  );
  const count = (status: CheckStatus) => outcomes.filter((outcome) => outcome.status === status).length;
  lines.push('', `${count('pass')} passed, ${count('fail')} failed, ${count('skip')} skipped`);
  return `${lines.join('\n')}\n`;
}

/** Non-zero when anything failed. A skipped check (a service that is switched off on purpose) is not a failure. */
export function exitCodeFor(outcomes: readonly CheckOutcome[]): 0 | 1 {
  return outcomes.some((outcome) => outcome.status === 'fail') ? 1 : 0;
}

// ---- what the services must be told, derived from APP_PUBLIC_URL so it cannot drift from it ----------------------------

/** Where Stripe must POST its events: Caddy strips `/api`, so the public address carries it. */
export function expectedStripeWebhookUrl(appPublicUrl: string): string {
  return `${appPublicUrl.replace(/\/+$/, '')}/api/webhooks/stripe`;
}

/** The redirect URI registered with Google, and the one `GOOGLE_CALLBACK_URL` must equal. */
export function expectedGoogleCallbackUrl(appPublicUrl: string): string {
  return `${appPublicUrl.replace(/\/+$/, '')}/api/auth/google/callback`;
}

/** Which Stripe mode a secret key belongs to, by its prefix: `null` for anything that is not a secret key. */
export function stripeKeyMode(secretKey: string): 'test' | 'live' | null {
  if (secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_')) return 'test';
  if (secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_')) return 'live';
  return null;
}

/** Why Google refused an authorization request, from the text of its error page. `null` when it did not refuse. */
export function googleRefusalReason(status: number, body: string): string | null {
  if (status >= 300 && status < 400) return null; // sent on to its sign-in page: the client and redirect URI were accepted
  if (/redirect_uri_mismatch/i.test(body)) {
    return 'redirect_uri_mismatch: GOOGLE_CALLBACK_URL is not among the client’s Authorized redirect URIs in Google Cloud';
  }
  if (/invalid_client|deleted_client|unauthorized_client/i.test(body)) {
    return 'invalid_client: GOOGLE_CLIENT_ID is not a client Google knows';
  }
  return `Google answered ${status}`;
}
