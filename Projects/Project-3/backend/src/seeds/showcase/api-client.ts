import { randomUUID } from 'node:crypto';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: unknown,
  ) {
    super(`${method} ${path} answered ${status}: ${describe(body)}`);
  }
}

function describe(body: unknown): string {
  if (typeof body === 'string') return body.slice(0, 300);
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    return Array.isArray(message) ? message.join('; ') : String(message);
  }
  return JSON.stringify(body)?.slice(0, 300) ?? '';
}

export const MIME = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

export interface Upload {
  bytes: Uint8Array;
  name: string;
  mime: string;
  /** Plain text fields of the multipart body. A list repeats the field. */
  fields?: Record<string, string | readonly string[]>;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Sign-in is limited to 10 a minute: leave at least this long between two. */
  signInGapMs?: number;
  /** How often a throttled or briefly failing request is tried again. */
  retries?: number;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The live API, reached over HTTP like any client: so storage, reports, quota, audit and billing all take their real path. */
export class Api {
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly signInGapMs: number;
  private readonly retries: number;
  private lastSignIn = 0;

  constructor(
    readonly base: string,
    options: ApiOptions = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.signInGapMs = options.signInGapMs ?? 6_500;
    this.retries = options.retries ?? 4;
  }

  /** Signs in, paced so a run of many people stays under the sign-in limit. */
  async signIn(email: string, password: string): Promise<Session> {
    const wait = this.lastSignIn + this.signInGapMs - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastSignIn = Date.now();
    const tokens = await this.send<Tokens>('POST', '/auth/login', { json: { email, password } });
    return new Session(this, email, password, tokens);
  }

  /** One request with retries for "slow down" (429) and for the server or network being briefly away. Never retries a client error. */
  async send<T>(method: string, path: string, init: { json?: unknown; form?: FormData; token?: string; idempotencyKey?: string } = {}): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.base}${path}`, {
          method,
          headers: {
            accept: 'application/json',
            ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
            ...(init.json !== undefined ? { 'content-type': 'application/json' } : {}),
            ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
          },
          body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
        });
      } catch (error) {
        if (attempt >= this.retries) throw error;
        await this.sleep(2_000 * 2 ** attempt);
        continue;
      }
      const text = await response.text();
      const body: unknown = text ? safeJson(text) : null;
      if (response.ok) return body as T;
      const transient = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;
      if (transient && attempt < this.retries) {
        const asked = Number(response.headers.get('retry-after'));
        await this.sleep(Number.isFinite(asked) && asked > 0 ? Math.min(asked, 60) * 1_000 : 5_000 * 2 ** attempt);
        continue;
      }
      throw new ApiError(response.status, method, path, body);
    }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** One signed-in person. A 401 is answered by refreshing the token, and if that fails by signing in again, once. */
export class Session {
  constructor(
    private readonly api: Api,
    readonly email: string,
    private readonly password: string,
    private tokens: Tokens,
  ) {}

  currentTokens(): Tokens {
    return this.tokens;
  }

  get<T>(path: string): Promise<T> {
    return this.call<T>('GET', path);
  }
  post<T>(path: string, json?: unknown): Promise<T> {
    return this.call<T>('POST', path, { json: json ?? {} });
  }
  put<T>(path: string, json: unknown): Promise<T> {
    return this.call<T>('PUT', path, { json });
  }
  delete<T>(path: string): Promise<T> {
    return this.call<T>('DELETE', path);
  }

  /** A multipart upload. The idempotency key is made once and kept across retries, so a retried upload never lands twice. */
  upload<T>(path: string, file: Upload): Promise<T> {
    const key = randomUUID();
    const form = (): FormData => {
      const data = new FormData();
      for (const [name, value] of Object.entries(file.fields ?? {})) {
        for (const item of typeof value === 'string' ? [value] : value) data.append(name, item);
      }
      data.append('file', new Blob([file.bytes as BlobPart], { type: file.mime }), file.name);
      return data;
    };
    return this.call<T>('POST', path, { form, idempotencyKey: key });
  }

  private async call<T>(method: string, path: string, init: { json?: unknown; form?: () => FormData; idempotencyKey?: string } = {}): Promise<T> {
    const attempt = (): Promise<T> =>
      this.api.send<T>(method, path, { json: init.json, form: init.form?.(), token: this.tokens.accessToken, idempotencyKey: init.idempotencyKey });
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      await this.renew();
      return attempt();
    }
  }

  private async renew(): Promise<void> {
    try {
      this.tokens = await this.api.send<Tokens>('POST', '/auth/refresh', { json: { refreshToken: this.tokens.refreshToken } });
    } catch {
      this.tokens = (await this.api.signIn(this.email, this.password)).currentTokens();
    }
  }
}
