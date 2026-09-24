import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { z } from 'zod';
import { AppModule } from '#/app.module.js';
import { PasswordHasher } from '#/auth/crypto/password-hasher.js';
import { CLOCK } from '#/core/clock/clock.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { MAIL_TRANSPORT } from '#/core/mail/mail-transport.js';
import { TaskRunner } from '#/core/tasks/task-runner.service.js';
import { FakeClock } from './fake-clock.js';
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
    private readonly runner: TaskRunner,
    private readonly db: PostgresTestContext,
  ) {}

  static async start(): Promise<AppHarness> {
    const clock = new FakeClock(START);
    const mail = new MailCapture();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(MAIL_TRANSPORT)
      .useValue(mail)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    return new AppHarness(app, clock, mail, app.get(TaskRunner), await PostgresTestContext.start());
  }

  /** Clean slate between tests: empty tables, empty outbox, clock back at the start. */
  async reset(): Promise<void> {
    await this.db.reset();
    this.mail.clear();
    this.clock.set(START);
  }

  async stop(): Promise<void> {
    await this.app.close();
    await this.db.stop();
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
    overrides: Partial<{ email: string; password: string; fullName: string }> = {},
  ): Promise<RegisteredAccount> {
    this.counter += 1;
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
        status: 'active',
        activatedAt: this.clock.now(),
        disabledAt: null,
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

  async login(email: string, password: string = DEFAULT_PASSWORD): Promise<SessionBody> {
    const response = await this.http().post('/auth/login').send({ email, password }).expect(200);
    return sessionSchema.parse(response.body);
  }

  parseSession(body: unknown): SessionBody {
    return sessionSchema.parse(body);
  }

  bearer(session: SessionBody): [string, string] {
    return ['Authorization', `Bearer ${session.accessToken}`];
  }
}
