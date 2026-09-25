import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from '#/app.module.js';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { AI_PROVIDER } from '#/core/ai/ai-provider.js';
import { LocalStorageDriver } from '#/core/storage/local-storage.driver.js';
import { STORAGE_DRIVER } from '#/core/storage/storage-driver.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { PasswordHasher } from '#/auth/crypto/password-hasher.js';
import { GOOGLE_OAUTH, type OAuthProfile } from '#/auth/oauth/oauth-provider.js';
import { CLOCK } from '#/core/clock/clock.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { MAIL_TRANSPORT } from '#/core/mail/mail-transport.js';
import { TaskRunner } from '#/core/tasks/task-runner.service.js';
import { FakeAiProvider } from './fake-ai.js';
import { FakeClock } from './fake-clock.js';
import { FakeGoogleOAuthProvider } from './fake-oauth.js';
import { MailCapture } from './mail-capture.js';
import { PostgresTestContext } from './postgres-context.js';

const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number(),
});
export type SessionBody = z.infer<typeof sessionSchema>;

const registeredSchema = z.object({ companyId: z.uuid(), userId: z.uuid() });

export interface RegisteredAccount {
  email: string;
  password: string;
  companyId: string;
  userId: string;
}

export const DEFAULT_PASSWORD = 'correct-horse-battery';

export interface GoogleStart {
  url: string;
  state: string;
  /** The `name=value` pair to send back as `Cookie`. */
  cookie: string;
}

export interface GoogleFlowResult {
  status: number;
  /** Where the API sent the browser: `/session/oauth-complete?code=…`, `?error=…`, `/register?oauthRegistration=…`. */
  location: URL;
  start: GoogleStart;
}

/** A fixed start, so a spec that forgets to move time still gets deterministic tokens. */
const START = new Date('2026-03-01T12:00:00.000Z');

/**
 * Boots the REAL `AppModule` — real guards, pipes, filter, TypeORM, Postgres —
 * and replaces only the edges of the system: the clock and the mail transport.
 * This is what SCOPE.md's traceability table calls "e2e"; here it is an
 * ordinary integration spec driving HTTP with supertest. No separate config,
 * no browser, no orchestration.
 *
 * Later phases add their fakes here (storage, AI, OAuth) as those seams appear.
 */
export class AppHarness {
  private counter = 0;

  private constructor(
    readonly app: INestApplication,
    readonly clock: FakeClock,
    readonly mail: MailCapture,
    readonly google: FakeGoogleOAuthProvider,
    /** Stands in for Gemini; script its answer with `h.ai.next(...)`. */
    readonly ai: FakeAiProvider,
    /** Local-disk storage in a temp dir; spy on its methods to inject failures. */
    readonly storage: LocalStorageDriver,
    readonly storageDir: string,
    private readonly runner: TaskRunner,
    private readonly db: PostgresTestContext,
  ) {}

  /** `googleConfigured: false` boots as if the `GOOGLE_*` variables were unset (the routes then answer 503). */
  static async start(options: { googleConfigured?: boolean } = {}): Promise<AppHarness> {
    const clock = new FakeClock(START);
    const mail = new MailCapture();
    const google = new FakeGoogleOAuthProvider();
    const ai = new FakeAiProvider();
    const storageDir = await mkdtemp(join(tmpdir(), 'gridline-storage-'));
    const storage = new LocalStorageDriver({
      root: storageDir,
      baseUrl: 'http://localhost:4000',
      secret: 'harness-secret',
      clock,
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(MAIL_TRANSPORT)
      .useValue(mail)
      .overrideProvider(GOOGLE_OAUTH)
      .useValue(options.googleConfigured === false ? null : google)
      .overrideProvider(STORAGE_DRIVER)
      .useValue(storage)
      .overrideProvider(AI_PROVIDER)
      .useValue(ai)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    return new AppHarness(
      app,
      clock,
      mail,
      google,
      ai,
      storage,
      storageDir,
      app.get(TaskRunner),
      await PostgresTestContext.start(),
    );
  }

  /** Clean slate between tests: empty tables, empty outbox, clock back at the start. */
  async reset(): Promise<void> {
    await this.db.reset();
    this.mail.clear();
    this.google.clear();
    this.ai.reset();
    this.clock.set(START);
    await rm(this.storageDir, { recursive: true, force: true });
    await mkdir(this.storageDir, { recursive: true });
  }

  async stop(): Promise<void> {
    await this.app.close();
    await this.db.stop();
    await rm(this.storageDir, { recursive: true, force: true });
  }

  http(): ReturnType<typeof request> {
    return request(this.app.getHttpServer());
  }

  get dataSource(): PostgresTestContext['dataSource'] {
    return this.db.dataSource;
  }

  /** Runs every queued task to completion — what the scheduler does in production. */
  async drainTasks(): Promise<void> {
    for (let pass = 0; pass < 20; pass += 1) {
      if ((await this.runner.drainOnce(50)).claimed === 0) return;
    }
    throw new Error('Task queue did not drain after 20 passes — a task is re-queuing itself');
  }

  /** A registration whose activation email has been "clicked". */
  async registerAndActivate(
    overrides: Partial<{ email: string; password: string; companyName: string }> = {},
  ): Promise<RegisteredAccount> {
    this.counter += 1;
    const email = overrides.email ?? `admin-${this.counter}-${randomUUID().slice(0, 8)}@acme.test`;
    const password = overrides.password ?? DEFAULT_PASSWORD;

    const registered = await this.http()
      .post('/auth/register-company')
      .send({
        companyName: overrides.companyName ?? `Acme ${this.counter}`,
        email,
        password,
        country: 'GE',
        industry: 'technology',
      })
      .expect(201);
    const { companyId, userId } = registeredSchema.parse(registered.body);

    await this.drainTasks();
    await this.http()
      .get('/auth/activate')
      .query({ token: this.mail.latestTokenTo(email) })
      .expect(200);

    return { email, password, companyId, userId };
  }

  /**
   * An active employee inserted directly. Stands in for the invite-and-accept
   * flow until Phase 4 builds it; specs that need a second role use this.
   */
  async seedEmployee(
    companyId: string,
    overrides: Partial<{
      email: string;
      password: string;
      fullName: string;
      status: 'invited' | 'active' | 'disabled';
    }> = {},
  ): Promise<RegisteredAccount> {
    this.counter += 1;
    const status = overrides.status ?? 'active';
    const email =
      overrides.email ?? `employee-${this.counter}-${randomUUID().slice(0, 8)}@acme.test`;
    const password = overrides.password ?? DEFAULT_PASSWORD;

    const users = this.dataSource.getRepository(User);
    const user = await users.save(
      users.create({
        companyId,
        email,
        fullName: overrides.fullName ?? `Employee ${this.counter}`,
        role: 'employee',
        status,
        activatedAt: status === 'invited' ? null : this.clock.now(),
        disabledAt: status === 'disabled' ? this.clock.now() : null,
      }),
    );

    const identities = this.dataSource.getRepository(AuthIdentity);
    await identities.save(
      identities.create({
        userId: user.id,
        provider: 'password',
        providerUserId: user.id,
        email,
        emailVerified: false,
        passwordHash: await new PasswordHasher().hash(password),
        lastUsedAt: null,
      }),
    );

    return { email, password, companyId, userId: user.id };
  }

  /** An admin invites someone; the queued email is sent. Returns the invited user's id and email. */
  async inviteEmployee(
    adminSession: SessionBody,
    overrides: Partial<{ email: string; fullName: string }> = {},
  ): Promise<{ email: string; fullName: string; userId: string }> {
    this.counter += 1;
    const email = overrides.email ?? `invitee-${this.counter}-${randomUUID().slice(0, 8)}@acme.test`;
    const fullName = overrides.fullName ?? `Invitee ${this.counter}`;

    const response = await this.http()
      .post('/employees')
      .set(...this.bearer(adminSession))
      .send({ email, fullName })
      .expect(201);
    await this.drainTasks();

    return { email, fullName, userId: z.object({ id: z.uuid() }).parse(response.body).id };
  }

  /** The whole invite flow: invite, read the emailed link, accept with a password. */
  async inviteAndAccept(
    adminSession: SessionBody,
    companyId: string,
    overrides: Partial<{ email: string; fullName: string; password: string }> = {},
  ): Promise<RegisteredAccount & { session: SessionBody }> {
    const invited = await this.inviteEmployee(adminSession, overrides);
    const password = overrides.password ?? DEFAULT_PASSWORD;

    const response = await this.http()
      .post('/auth/accept-invite')
      .send({ token: this.mail.latestTokenTo(invited.email), password })
      .expect(200);

    return {
      email: invited.email,
      password,
      companyId,
      userId: invited.userId,
      session: sessionSchema.parse(response.body),
    };
  }

  /** The admin's mandatory first plan choice. */
  async subscribe(session: SessionBody, plan: 'free' | 'basic' | 'premium'): Promise<void> {
    await this.http()
      .post('/subscriptions/me')
      .set(...this.bearer(session))
      .send({ plan })
      .expect(201);
  }

  /**
   * `count` uploads recorded in the billing period whose start date is `periodKey`.
   * A usage event has a real foreign key to its file, so each one gets a real
   * (bare, unstored) file row, uploaded by the company's first user.
   */
  async seedUsage(companyId: string, count: number, periodKey: string): Promise<void> {
    if (count === 0) return;

    const uploader = await this.dataSource
      .getRepository(User)
      .findOneOrFail({ where: { companyId }, order: { createdAt: 'ASC' } });
    const files = Array.from({ length: count }, () => {
      const id = randomUUID();
      return {
        id,
        companyId,
        uploaderId: uploader.id,
        originalName: 'seeded.csv',
        mimeType: 'text/csv',
        sizeBytes: 1,
        storageKey: `seeded/${id}`,
        visibility: 'company' as const,
        deletedAt: null,
      };
    });
    await this.dataSource.getRepository(FileAsset).insert(files);
    await this.dataSource
      .getRepository(UsageEvent)
      .insert(files.map((file) => ({ companyId, fileId: file.id, periodKey })));
  }

  /** A stretch of billable seat time for an existing employee (Phase 4 writes these for real). */
  async seedSeatInterval(
    companyId: string,
    userId: string,
    activeFrom: Date,
    activeTo: Date | null,
  ): Promise<void> {
    await this.dataSource
      .getRepository(SeatInterval)
      .insert({ companyId, userId, activeFrom, activeTo });
  }

  async login(email: string, password: string = DEFAULT_PASSWORD): Promise<SessionBody> {
    const response = await this.http().post('/auth/login').send({ email, password }).expect(200);
    return sessionSchema.parse(response.body);
  }

  /**
   * Drives one whole Google round trip the way a browser would: ask the API for the
   * authorization URL (keeping its nonce cookie), "sign in at Google" as `profile`,
   * then hit the callback with the code, the state and the cookie. Redirects are not
   * followed — the spec reads where the API sent the browser.
   */
  async googleFlow(
    flow: {
      intent: 'login' | 'register' | 'invite' | 'link';
      profile?: Partial<OAuthProfile>;
      inviteToken?: string;
      /** Required for `link`: who is linking. */
      session?: SessionBody;
    },
  ): Promise<GoogleFlowResult> {
    const start = await this.googleStart(flow);
    return this.googleCallback(start, this.google.issueCode(flow.profile));
  }

  async googleStart(flow: {
    intent: 'login' | 'register' | 'invite' | 'link';
    inviteToken?: string;
    session?: SessionBody;
  }): Promise<GoogleStart> {
    const response =
      flow.intent === 'link'
        ? await this.http()
            .post('/auth/identities/google/link')
            .set(...this.bearer(this.requireSession(flow.session)))
            .expect(200)
        : await this.http()
            .post('/auth/oauth/google/url')
            .send({ intent: flow.intent, inviteToken: flow.inviteToken })
            .expect(200);

    const { url } = z.object({ url: z.string() }).parse(response.body);
    const state = new URL(url).searchParams.get('state');
    if (!state) throw new Error('The authorization URL carries no state');

    const setCookie: unknown = response.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie : [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.split(';')[0])
      .find((pair) => pair?.startsWith('gl_oauth_nonce='));
    if (!cookie) throw new Error('The URL response set no nonce cookie');

    return { url, state, cookie };
  }

  /** The provider redirecting the browser back. Override `cookie`/`state` to simulate tampering. */
  async googleCallback(
    start: GoogleStart,
    code: string,
    overrides: Partial<{ state: string; cookie: string | null }> = {},
  ): Promise<GoogleFlowResult> {
    const request = this.http()
      .get('/auth/google/callback')
      .query({ code, state: overrides.state ?? start.state });
    const cookie = overrides.cookie === undefined ? start.cookie : overrides.cookie;
    if (cookie) request.set('Cookie', cookie);

    const response = await request;
    const location = response.headers['location'];
    if (typeof location !== 'string') {
      throw new Error(`The callback did not redirect (status ${response.status}): ${response.text}`);
    }
    return { status: response.status, location: new URL(location), start };
  }

  /** Trades a callback's `code` for a session, as the BFF does. */
  async exchangeOAuthCode(code: string) {
    return this.http().post('/auth/oauth/exchange').send({ code });
  }

  private requireSession(session: SessionBody | undefined): SessionBody {
    if (!session) throw new Error('This Google flow needs a signed-in session');
    return session;
  }

  /**
   * `POST /files`, ready to `.expect(...)`. Defaults to a small unique CSV so two
   * uploads are never byte-identical by accident (which idempotency would treat as a retry).
   */
  upload(
    session: SessionBody,
    options: Partial<{
      name: string;
      content: Buffer | string;
      contentType: string;
      visibility: 'company' | 'restricted';
      grantedUserIds: string[];
      idempotencyKey: string;
    }> = {},
  ) {
    this.counter += 1;
    const content = options.content ?? `id,value
${this.counter},${randomUUID()}
`;
    const request = this.http()
      .post('/files')
      .set(...this.bearer(session));
    if (options.idempotencyKey) request.set('Idempotency-Key', options.idempotencyKey);
    request.attach('file', Buffer.from(content), {
      filename: options.name ?? `data-${this.counter}.csv`,
      contentType: options.contentType ?? 'text/csv',
    });
    if (options.visibility) request.field('visibility', options.visibility);
    for (const userId of options.grantedUserIds ?? []) request.field('grantedUserIds', userId);
    return request;
  }

  parseSession(body: unknown): SessionBody {
    return sessionSchema.parse(body);
  }

  bearer(session: SessionBody): [string, string] {
    return ['Authorization', `Bearer ${session.accessToken}`];
  }
}
