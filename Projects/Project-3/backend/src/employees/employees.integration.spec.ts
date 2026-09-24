import { randomUUID } from 'node:crypto';
import { IsNull } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, DEFAULT_PASSWORD, type RegisteredAccount, type SessionBody } from '#test/support/app-harness.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { AuthToken } from '#/database/entities/auth-token.entity.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { Invoice } from '#/billing/invoice.entity.js';
import { parseLineItems } from '#/billing/line-item.schema.js';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import { RefreshToken } from '#/database/entities/refresh-token.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { INVITE_TOKEN_TTL_MS } from '#/auth/auth.constants.js';
import type { Plan } from '#/subscriptions/plan-catalog.js';

const iso = (value: string) => new Date(value).toISOString();

describe('employees: invite, accept, disable, reactivate (integration)', () => {
  let h: AppHarness;
  let admin: RegisteredAccount;
  let adminSession: SessionBody;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    admin = await h.registerAndActivate();
    adminSession = await h.login(admin.email);
  });

  afterAll(() => h.stop());

  const as = (session: SessionBody) => h.bearer(session);
  const auth = () => as(adminSession);
  const users = () => h.dataSource.getRepository(User);
  const seats = () => h.dataSource.getRepository(SeatInterval);

  /** One request by verb, without indexing the agent by a string. */
  function call(method: 'GET' | 'POST' | 'DELETE', path: string, session: SessionBody | undefined, body?: object) {
    const agent = h.http();
    const pending = method === 'GET' ? agent.get(path) : method === 'POST' ? agent.post(path) : agent.delete(path);
    const authed = session ? pending.set(...as(session)) : pending;
    return body ? authed.send(body) : authed;
  }
  const INVITE_BODY = { email: 'x@y.test', fullName: 'X' };

  async function withPlan(plan: Plan): Promise<void> {
    await h.subscribe(adminSession, plan);
  }

  /** Re-issues the admin's session after moving the clock (the 15-minute token would have lapsed). */
  async function travelTo(instant: string): Promise<void> {
    h.clock.set(new Date(instant));
    adminSession = await h.login(admin.email);
  }

  describe('access: who may call, in what order the guards answer', () => {
    it('on a company with no plan: 401 unauthenticated, 403 wrong role, 402 only for the admin who can fix it', async () => {
      const employee = await h.seedEmployee(admin.companyId);
      const employeeSession = await h.login(employee.email);

      // Never 402 for someone who is not allowed in at all — guard ORDER.
      await h.http().get('/employees').expect(401);
      await h.http().get('/employees').set(...as(employeeSession)).expect(403);
      const response = await h.http().get('/employees').set(...auth()).expect(402);
      expect(response.body.message).toMatch(/POST \/subscriptions\/me/);
    });

    it.each([
      ['POST', '/employees'],
      ['GET', '/employees'],
      ['POST', `/employees/${randomUUID()}/resend-invite`],
      ['DELETE', `/employees/${randomUUID()}`],
      ['POST', `/employees/${randomUUID()}/reactivate`],
    ] as const)('%s %s answers 402 for an admin with no plan', async (method, path) => {
      const response = await call(method, path, adminSession, path === '/employees' && method === 'POST' ? INVITE_BODY : undefined);

      expect(response.status).toBe(402);
    });

    it.each([
      ['POST', '/employees'],
      ['GET', '/employees'],
      ['POST', `/employees/${randomUUID()}/resend-invite`],
      ['DELETE', `/employees/${randomUUID()}`],
      ['POST', `/employees/${randomUUID()}/reactivate`],
    ] as const)('an employee gets 403 on %s %s', async (method, path) => {
      await withPlan('basic');
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);

      const response = await call(method, path, employee.session, path === '/employees' && method === 'POST' ? INVITE_BODY : undefined);

      expect(response.status).toBe(403);
    });

    it('rejects a malformed id before doing anything', async () => {
      await withPlan('basic');

      await h.http().delete('/employees/not-a-uuid').set(...auth()).expect(400);
      await h.http().post('/employees/not-a-uuid/resend-invite').set(...auth()).expect(400);
    });
  });

  describe('POST /employees — invite', () => {
    beforeEach(() => withPlan('basic'));

    it('creates an invited employee and returns a record with no credentials', async () => {
      const response = await h
        .http()
        .post('/employees')
        .set(...auth())
        .send({ email: 'Nino@Acme.test', fullName: '  Nino Beridze ' })
        .expect(201);

      expect(response.body).toMatchObject({
        email: 'nino@acme.test',
        fullName: 'Nino Beridze',
        role: 'employee',
        status: 'invited',
        activatedAt: null,
        disabledAt: null,
      });
      expect(Object.keys(response.body).sort()).toEqual(
        ['activatedAt', 'createdAt', 'disabledAt', 'email', 'fullName', 'id', 'role', 'status'],
      );
    });

    it('emails the invitation (after the task runs) with a link to /accept-invite', async () => {
      await h.inviteEmployee(adminSession, { email: 'nino@acme.test', fullName: 'Nino' });

      const email = h.mail.latestTo('nino@acme.test');
      expect(email?.subject).toMatch(/invited to .* on Gridline/);
      expect(h.mail.latestLinkTo('nino@acme.test').pathname).toBe('/accept-invite');
      expect(email?.text).toContain('Hi Nino');
    });

    it('holds a seat but bills nothing: an invited employee has no seat interval', async () => {
      const invited = await h.inviteEmployee(adminSession);

      expect(await seats().countBy({ userId: invited.userId })).toBe(0);
    });

    it('records the invitation in the audit trail, attributed to the admin', async () => {
      const invited = await h.inviteEmployee(adminSession);

      const entry = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({ action: 'employee.invited' });
      expect(entry).toMatchObject({ actorUserId: admin.userId, companyId: admin.companyId, targetId: invited.userId });
    });

    it.each([
      ['a malformed email', { email: 'nope', fullName: 'X' }],
      ['a missing name', { email: 'a@b.test' }],
      ['a blank name', { email: 'a@b.test', fullName: '  ' }],
      ['a role smuggled in', { email: 'a@b.test', fullName: 'X', role: 'admin' }],
      ['a status smuggled in', { email: 'a@b.test', fullName: 'X', status: 'active' }],
      ['a companyId smuggled in', { email: 'a@b.test', fullName: 'X', companyId: randomUUID() }],
    ])('rejects %s', async (_name, body) => {
      await h.http().post('/employees').set(...auth()).send(body).expect(400);
      expect(await users().count()).toBe(1); // just the admin
    });

    describe('duplicates', () => {
      it('rejects the same email twice in one company, case-insensitively', async () => {
        await h.inviteEmployee(adminSession, { email: 'dup@acme.test' });

        await h.http().post('/employees').set(...auth()).send({ email: 'DUP@acme.test', fullName: 'Again' }).expect(409);
      });

      it('rejects an address that already belongs to a Gridline account — the admin’s own', async () => {
        const response = await h.http().post('/employees').set(...auth()).send({ email: admin.email, fullName: 'Me again' }).expect(409);

        expect(response.body.message).toMatch(/already belongs to a Gridline account/);
      });

      it('rejects another company’s admin address, rather than send an invitation that dead-ends', async () => {
        const rival = await h.registerAndActivate({ companyName: 'Rival' });

        await h.http().post('/employees').set(...auth()).send({ email: rival.email, fullName: 'Poached' }).expect(409);
      });

      it('tells the admin to reactivate when the address is someone they removed', async () => {
        const employee = await h.inviteAndAccept(adminSession, admin.companyId);
        await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

        const response = await h.http().post('/employees').set(...auth()).send({ email: employee.email, fullName: 'Back' }).expect(409);

        expect(response.body.message).toMatch(/reactivate/i);
      });
    });
  });

  describe('the seat cap (an invitation holds a seat, D4)', () => {
    it('Basic: the 10th invitation is accepted, the 11th refused with the reason', async () => {
      await withPlan('basic');
      for (let i = 0; i < 10; i += 1) await h.inviteEmployee(adminSession);

      const response = await h.http().post('/employees').set(...auth()).send({ email: 'eleventh@acme.test', fullName: 'Eleventh' }).expect(409);

      expect(response.body.message).toMatch(/Basic plan allows 10 employees/);
      expect(response.body.message).toMatch(/invitation holds a seat/);
      expect(await users().count()).toBe(11); // admin + 10
    });

    it('Free: no employee seats at all', async () => {
      await withPlan('free');

      const response = await h.http().post('/employees').set(...auth()).send({ email: 'a@acme.test', fullName: 'A' }).expect(409);

      expect(response.body.message).toBe('The Free plan has no employee seats. Upgrade to invite employees.');
    });

    it('Premium: no cap', async () => {
      await withPlan('premium');
      for (let i = 0; i < 12; i += 1) await h.inviteEmployee(adminSession);

      expect(await users().count()).toBe(13);
    });

    it('removing someone frees their seat for the next invitation', async () => {
      await withPlan('basic');
      const invitees: string[] = [];
      for (let i = 0; i < 10; i += 1) invitees.push((await h.inviteEmployee(adminSession)).userId);
      await h.http().post('/employees').set(...auth()).send({ email: 'x@acme.test', fullName: 'X' }).expect(409);

      await h.http().delete(`/employees/${invitees[0]}`).set(...auth()).expect(200);

      await h.http().post('/employees').set(...auth()).send({ email: 'x@acme.test', fullName: 'X' }).expect(201);
    });

    it('takes the subscription row lock, so an invitation waits behind any other seat change', async () => {
      await withPlan('basic');
      // Another writer (a plan change, the rollover job) holds the row lock…
      const holder = h.dataSource.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      await holder.query('SELECT id FROM subscription WHERE "companyId" = $1 FOR UPDATE', [admin.companyId]);

      let answered = false;
      const pending = h
        .http()
        .post('/employees')
        .set(...auth())
        .send({ email: 'waits@acme.test', fullName: 'Waits' })
        .then((response) => {
          answered = true;
          return response;
        });

      try {
        // …so the invitation must not get an answer while it is held. Without the
        // lock it would sail through in a few milliseconds.
        await new Promise((resolve) => setTimeout(resolve, 600));
        expect(answered).toBe(false);
      } finally {
        await holder.commitTransaction();
        await holder.release();
      }

      expect((await pending).status).toBe(201);
    });

    it('lets exactly one of two simultaneous invitations take the last seat', async () => {
      await withPlan('basic');
      for (let i = 0; i < 9; i += 1) await h.inviteEmployee(adminSession);

      const statuses = (
        await Promise.all([
          h.http().post('/employees').set(...auth()).send({ email: 'race-a@acme.test', fullName: 'A' }),
          h.http().post('/employees').set(...auth()).send({ email: 'race-b@acme.test', fullName: 'B' }),
        ])
      )
        .map((response) => response.status)
        .sort();

      expect(statuses).toEqual([201, 409]);
      expect(await users().count()).toBe(11);
    });

    it('does not count another company’s people against this cap', async () => {
      await withPlan('basic');
      const rival = await h.registerAndActivate({ companyName: 'Rival' });
      const rivalSession = await h.login(rival.email);
      await h.subscribe(rivalSession, 'premium');
      for (let i = 0; i < 15; i += 1) await h.inviteEmployee(rivalSession);

      await h.http().post('/employees').set(...auth()).send({ email: 'mine@acme.test', fullName: 'Mine' }).expect(201);
    });
  });

  describe('POST /auth/accept-invite', () => {
    beforeEach(() => withPlan('basic'));

    it('invite → accept → the employee is active, signed in, and can log in again', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);

      const me = await h.http().get('/auth/me').set(...as(employee.session)).expect(200);
      expect(me.body.user).toMatchObject({ id: employee.userId, role: 'employee', status: 'active', email: employee.email });
      await h.login(employee.email, employee.password);
    });

    it('opens the billable seat interval at the moment of acceptance — that is when billing starts', async () => {
      const invited = await h.inviteEmployee(adminSession);
      h.clock.advance(3 * 60 * 60_000);

      await h.http().post('/auth/accept-invite').send({ token: h.mail.latestTokenTo(invited.email), password: DEFAULT_PASSWORD }).expect(200);

      const [interval] = await seats().findBy({ userId: invited.userId });
      expect(interval?.activeFrom.toISOString()).toBe(h.clock.now().toISOString());
      expect(interval?.activeTo).toBeNull();
      expect(interval?.companyId).toBe(admin.companyId);
    });

    it('creates a password identity keyed by user id, with the email marked verified, never the plaintext', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);

      const identity = await h.dataSource.getRepository(AuthIdentity).findOneByOrFail({ userId: employee.userId });
      expect(identity).toMatchObject({ provider: 'password', providerUserId: employee.userId, emailVerified: true });
      expect(identity.passwordHash).toMatch(/^scrypt\$/);
      expect(identity.passwordHash).not.toContain(DEFAULT_PASSWORD);
    });

    it('spends the token: a second use is rejected', async () => {
      const invited = await h.inviteEmployee(adminSession);
      const token = h.mail.latestTokenTo(invited.email);

      await h.http().post('/auth/accept-invite').send({ token, password: DEFAULT_PASSWORD }).expect(200);
      await h.http().post('/auth/accept-invite').send({ token, password: 'another-password-1' }).expect(400);
      await h.login(invited.email, DEFAULT_PASSWORD); // the first password stands
    });

    it('lets exactly one of two simultaneous acceptances win', async () => {
      const invited = await h.inviteEmployee(adminSession);
      const token = h.mail.latestTokenTo(invited.email);

      const statuses = (
        await Promise.all([
          h.http().post('/auth/accept-invite').send({ token, password: DEFAULT_PASSWORD }),
          h.http().post('/auth/accept-invite').send({ token, password: 'another-password-1' }),
        ])
      )
        .map((response) => response.status)
        .sort();

      expect(statuses).toEqual([200, 400]);
      expect(await seats().countBy({ userId: invited.userId })).toBe(1); // one interval, not two
    });

    it('rejects an expired invitation, and a resend gives a working one', async () => {
      const invited = await h.inviteEmployee(adminSession);
      const expired = h.mail.latestTokenTo(invited.email);
      h.clock.advance(INVITE_TOKEN_TTL_MS + 1_000);
      await h.http().post('/auth/accept-invite').send({ token: expired, password: DEFAULT_PASSWORD }).expect(400);

      adminSession = await h.login(admin.email);
      await h.http().post(`/employees/${invited.userId}/resend-invite`).set(...auth()).expect(200);
      await h.drainTasks();

      await h.http().post('/auth/accept-invite').send({ token: h.mail.latestTokenTo(invited.email), password: DEFAULT_PASSWORD }).expect(200);
    });

    it('rejects an unknown token, an empty body and a weak password — without spending the token', async () => {
      const invited = await h.inviteEmployee(adminSession);
      const token = h.mail.latestTokenTo(invited.email);

      await h.http().post('/auth/accept-invite').send({ token: 'never-issued', password: DEFAULT_PASSWORD }).expect(400);
      await h.http().post('/auth/accept-invite').send({}).expect(400);
      await h.http().post('/auth/accept-invite').send({ token, password: 'short' }).expect(400);

      await h.http().post('/auth/accept-invite').send({ token, password: DEFAULT_PASSWORD }).expect(200);
    });

    it('will not accept another kind of token', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.http().post('/auth/password/forgot').send({ email: employee.email }).expect(200);
      await h.drainTasks();

      // A password-reset link is not an invitation.
      await h.http().post('/auth/accept-invite').send({ token: h.mail.latestTokenTo(employee.email), password: 'another-password-1' }).expect(400);
    });

    it('audits the acceptance, attributed to the employee', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);

      const entry = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({ action: 'employee.accepted_invite' });
      expect(entry).toMatchObject({ actorUserId: employee.userId, companyId: admin.companyId });
    });
  });

  describe('GET /employees', () => {
    beforeEach(() => withPlan('premium'));

    it('lists everyone in the company, oldest first, with pagination metadata', async () => {
      const first = await h.inviteEmployee(adminSession, { fullName: 'First' });
      const second = await h.inviteEmployee(adminSession, { fullName: 'Second' });

      const response = await h.http().get('/employees').set(...auth()).expect(200);

      expect(response.body.data.map((row: { id: string }) => row.id)).toEqual([admin.userId, first.userId, second.userId]);
      expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
    });

    it('pages through the results', async () => {
      for (let i = 0; i < 4; i += 1) await h.inviteEmployee(adminSession);

      const page1 = await h.http().get('/employees').query({ page: 1, limit: 2 }).set(...auth()).expect(200);
      const page3 = await h.http().get('/employees').query({ page: 3, limit: 2 }).set(...auth()).expect(200);

      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
      expect(page3.body.data).toHaveLength(1);
    });

    it('filters by status and by role', async () => {
      await h.inviteAndAccept(adminSession, admin.companyId);
      await h.inviteEmployee(adminSession);

      const invited = await h.http().get('/employees').query({ status: 'invited' }).set(...auth()).expect(200);
      const admins = await h.http().get('/employees').query({ role: 'admin' }).set(...auth()).expect(200);
      const activeEmployees = await h.http().get('/employees').query({ status: 'active', role: 'employee' }).set(...auth()).expect(200);

      expect(invited.body.meta.total).toBe(1);
      expect(admins.body.data.map((row: { id: string }) => row.id)).toEqual([admin.userId]);
      expect(activeEmployees.body.meta.total).toBe(1);
    });

    it('includes removed employees, so they can be reactivated', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

      const response = await h.http().get('/employees').query({ status: 'disabled' }).set(...auth()).expect(200);

      expect(response.body.data).toEqual([expect.objectContaining({ id: employee.userId, status: 'disabled' })]);
    });

    it.each([
      ['an unknown status', { status: 'banned' }],
      ['an unknown role', { role: 'owner' }],
      ['a page of 0', { page: 0 }],
      ['a limit over 100', { limit: 101 }],
      ['an unknown parameter', { sort: 'email' }],
    ])('rejects %s', async (_name, query) => {
      await h.http().get('/employees').query(query).set(...auth()).expect(400);
    });

    it('never shows another company’s people, and never a credential', async () => {
      const rival = await h.registerAndActivate({ companyName: 'Rival' });
      const rivalSession = await h.login(rival.email);
      await h.subscribe(rivalSession, 'basic');
      await h.inviteEmployee(rivalSession);

      const response = await h.http().get('/employees').set(...auth()).expect(200);

      expect(response.body.meta.total).toBe(1);
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|scrypt|tokenHash/);
    });
  });

  describe('POST /employees/:id/resend-invite', () => {
    beforeEach(() => withPlan('basic'));

    it('emails a new link and kills the old one', async () => {
      const invited = await h.inviteEmployee(adminSession);
      const oldToken = h.mail.latestTokenTo(invited.email);

      await h.http().post(`/employees/${invited.userId}/resend-invite`).set(...auth()).expect(200);
      await h.drainTasks();
      const newToken = h.mail.latestTokenTo(invited.email);

      expect(newToken).not.toBe(oldToken);
      await h.http().post('/auth/accept-invite').send({ token: oldToken, password: DEFAULT_PASSWORD }).expect(400);
      await h.http().post('/auth/accept-invite').send({ token: newToken, password: DEFAULT_PASSWORD }).expect(200);
    });

    it('is only for pending invitations', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);

      await h.http().post(`/employees/${employee.userId}/resend-invite`).set(...auth()).expect(409);
    });

    it('is 404 for an unknown id and for another company’s person', async () => {
      const rival = await h.registerAndActivate({ companyName: 'Rival' });
      const rivalSession = await h.login(rival.email);
      await h.subscribe(rivalSession, 'basic');
      const theirs = await h.inviteEmployee(rivalSession);

      await h.http().post(`/employees/${randomUUID()}/resend-invite`).set(...auth()).expect(404);
      await h.http().post(`/employees/${theirs.userId}/resend-invite`).set(...auth()).expect(404);
    });
  });

  describe('DELETE /employees/:id — soft-disable (D7)', () => {
    beforeEach(() => withPlan('basic'));

    it('disables the employee and reports it', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      h.clock.advance(60 * 60_000);
      adminSession = await h.login(admin.email);

      const response = await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

      expect(response.body).toMatchObject({ id: employee.userId, status: 'disabled', disabledAt: h.clock.now().toISOString() });
      // A soft-disable: the row is still there.
      expect(await users().countBy({ id: employee.userId })).toBe(1);
    });

    it('locks them out at once: live access token, refresh token and password all stop working', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.http().get('/auth/me').set(...as(employee.session)).expect(200);

      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

      await h.http().get('/auth/me').set(...as(employee.session)).expect(401);
      await h.http().post('/auth/refresh').send({ refreshToken: employee.session.refreshToken }).expect(401);
      await h.http().post('/auth/login').send({ email: employee.email, password: employee.password }).expect(401);
    });

    it('removes their login identity and revokes every session', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.login(employee.email); // a second device

      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

      expect(await h.dataSource.getRepository(AuthIdentity).countBy({ userId: employee.userId })).toBe(0);
      expect(await h.dataSource.getRepository(RefreshToken).countBy({ userId: employee.userId, revokedAt: IsNull() })).toBe(0);
    });

    it('closes the billable seat interval today, so billing stops', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      h.clock.advance(5 * 24 * 60 * 60_000);
      adminSession = await h.login(admin.email);

      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

      const [interval] = await seats().findBy({ userId: employee.userId });
      expect(interval?.activeTo?.toISOString()).toBe(h.clock.now().toISOString());
    });

    it('spends their outstanding links: a pending invitation is cancelled by removing the invitee', async () => {
      const invited = await h.inviteEmployee(adminSession);
      const token = h.mail.latestTokenTo(invited.email);

      await h.http().delete(`/employees/${invited.userId}`).set(...auth()).expect(200);

      await h.http().post('/auth/accept-invite').send({ token, password: DEFAULT_PASSWORD }).expect(400);
      expect(await h.dataSource.getRepository(AuthToken).countBy({ userId: invited.userId, consumedAt: IsNull() })).toBe(0);
    });

    it('drops them from the members list and frees their seat', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      const before = await h.http().get('/subscriptions/me').set(...auth()).expect(200);
      expect(before.body.usage.employees).toBe(1);

      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

      const after = await h.http().get('/subscriptions/me').set(...auth()).expect(200);
      expect(after.body.usage).toMatchObject({ employees: 0, seats: 1 });
      const members = await h.http().get('/companies/me/members').set(...auth()).expect(200);
      expect(members.body.map((m: { id: string }) => m.id)).not.toContain(employee.userId);
    });

    it('keeps what they created: the audit trail still resolves to them', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

      const entries = await h.dataSource.getRepository(AuditLogEntry).findBy({ actorUserId: employee.userId });
      expect(entries.length).toBeGreaterThan(0);
      expect(await users().countBy({ id: employee.userId })).toBe(1);
    });

    it('will not let an admin remove themself', async () => {
      const response = await h.http().delete(`/employees/${admin.userId}`).set(...auth()).expect(400);

      expect(response.body.message).toMatch(/yourself/);
      expect((await users().findOneByOrFail({ id: admin.userId })).status).toBe('active');
    });

    it('will not remove another admin', async () => {
      const promoted = await h.seedEmployee(admin.companyId);
      await users().update({ id: promoted.userId }, { role: 'admin' });

      const response = await h.http().delete(`/employees/${promoted.userId}`).set(...auth()).expect(400);

      expect(response.body.message).toMatch(/admin account cannot/);
    });

    it('answers 409 the second time, and 404 for an unknown or another company’s person', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(409);

      const rival = await h.registerAndActivate({ companyName: 'Rival' });
      await h.http().delete(`/employees/${rival.userId}`).set(...auth()).expect(404);
      await h.http().delete(`/employees/${randomUUID()}`).set(...auth()).expect(404);
      expect((await users().findOneByOrFail({ id: rival.userId })).status).toBe('active');
    });

    it('audits the removal', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

      const entry = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({ action: 'employee.disabled' });
      expect(entry).toMatchObject({ actorUserId: admin.userId, targetId: employee.userId });
    });
  });

  describe('POST /employees/:id/reactivate', () => {
    beforeEach(() => withPlan('basic'));

    it('turns a removed employee into a fresh invitation that holds a seat', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);
      h.mail.clear();

      const response = await h.http().post(`/employees/${employee.userId}/reactivate`).set(...auth()).expect(200);
      await h.drainTasks();

      expect(response.body).toMatchObject({ status: 'invited', disabledAt: null });
      expect(h.mail.latestLinkTo(employee.email).pathname).toBe('/accept-invite');
    });

    it('lets them accept and set a NEW password; the old sessions stay dead', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);
      await h.http().post(`/employees/${employee.userId}/reactivate`).set(...auth()).expect(200);
      await h.drainTasks();

      await h.http().post('/auth/accept-invite').send({ token: h.mail.latestTokenTo(employee.email), password: 'a-new-passphrase-2' }).expect(200);

      await h.login(employee.email, 'a-new-passphrase-2');
      await h.http().post('/auth/login').send({ email: employee.email, password: employee.password }).expect(401);
      await h.http().post('/auth/refresh').send({ refreshToken: employee.session.refreshToken }).expect(401);
    });

    it('re-checks the seat cap: refused when the freed seat has since been taken', async () => {
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);
      for (let i = 0; i < 10; i += 1) await h.inviteEmployee(adminSession); // fills all 10

      const response = await h.http().post(`/employees/${employee.userId}/reactivate`).set(...auth()).expect(409);

      expect(response.body.message).toMatch(/all 10 seats are taken/);
      expect((await users().findOneByOrFail({ id: employee.userId })).status).toBe('disabled');
    });

    it('is only for removed employees', async () => {
      const active = await h.inviteAndAccept(adminSession, admin.companyId);
      const invited = await h.inviteEmployee(adminSession);

      await h.http().post(`/employees/${active.userId}/reactivate`).set(...auth()).expect(409);
      await h.http().post(`/employees/${invited.userId}/reactivate`).set(...auth()).expect(409);
    });

    it('is 404 for another company’s person', async () => {
      const rival = await h.registerAndActivate({ companyName: 'Rival' });

      await h.http().post(`/employees/${rival.userId}/reactivate`).set(...auth()).expect(404);
    });
  });

  describe('GET /companies/me/members — names only, for everyone', () => {
    beforeEach(() => withPlan('premium'));

    it('an employee sees id + fullName and NOTHING else, for active people only', async () => {
      const viewer = await h.inviteAndAccept(adminSession, admin.companyId, { fullName: 'Viewer' });
      const colleague = await h.inviteAndAccept(adminSession, admin.companyId, { fullName: 'Colleague' });
      await h.inviteEmployee(adminSession, { fullName: 'Pending' });
      const gone = await h.inviteAndAccept(adminSession, admin.companyId, { fullName: 'Gone' });
      await h.http().delete(`/employees/${gone.userId}`).set(...auth()).expect(200);

      const response = await h.http().get('/companies/me/members').set(...as(viewer.session)).expect(200);

      // The exact key set is the contract: any new field widens what employees can learn.
      for (const member of response.body) expect(Object.keys(member).sort()).toEqual(['fullName', 'id']);
      const names = response.body.map((m: { fullName: string }) => m.fullName);
      expect(names).toContain('Colleague');
      expect(names).toContain('Viewer');
      expect(names).not.toContain('Pending');
      expect(names).not.toContain('Gone');
      expect(response.body.find((m: { id: string }) => m.id === colleague.userId)).toEqual({ id: colleague.userId, fullName: 'Colleague' });
    });

    it('is ordered by name and open to admins too', async () => {
      await h.inviteAndAccept(adminSession, admin.companyId, { fullName: 'Zed' });
      await h.inviteAndAccept(adminSession, admin.companyId, { fullName: 'Abe' });

      const response = await h.http().get('/companies/me/members').set(...auth()).expect(200);

      const names = response.body.map((m: { fullName: string }) => m.fullName);
      expect(names).toEqual([...names].sort());
    });

    it('is scoped to the caller’s company', async () => {
      const rival = await h.registerAndActivate({ companyName: 'Rival' });
      const rivalSession = await h.login(rival.email);

      const response = await h.http().get('/companies/me/members').set(...as(rivalSession)).expect(200);

      expect(response.body.map((m: { id: string }) => m.id)).toEqual([rival.userId]);
    });

    it('needs a token, but not a subscription', async () => {
      await h.http().get('/companies/me/members').expect(401);
    });
  });

  describe('billing: the seat interval is what the calculator reads', () => {
    it('one employee who joined on Mar 1 and was removed on Mar 11 bills 10 days, not the whole period', async () => {
      await withPlan('basic');
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await travelTo('2026-03-11T09:00:00Z');
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);

      await travelTo('2026-03-21T09:00:00Z');
      const change = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }).expect(200);

      // Mar 1..10 = 10 of 31 days: 500 * 10 / 31 = 161.3 -> 161 — not Mar 1..20.
      expect(change.body.prorationCents).toBe(161);
    });

    it('a removed-and-reactivated employee is billed for BOTH stretches — the case seat_interval exists for', async () => {
      await withPlan('basic');
      const employee = await h.inviteAndAccept(adminSession, admin.companyId);
      await travelTo('2026-03-11T09:00:00Z');
      await h.http().delete(`/employees/${employee.userId}`).set(...auth()).expect(200);
      await travelTo('2026-03-21T09:00:00Z');
      await h.http().post(`/employees/${employee.userId}/reactivate`).set(...auth()).expect(200);
      await h.drainTasks();
      await h.http().post('/auth/accept-invite').send({ token: h.mail.latestTokenTo(employee.email), password: DEFAULT_PASSWORD }).expect(200);

      await travelTo('2026-03-31T09:00:00Z');
      const change = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }).expect(200);

      // Mar 1..10 (10 days) + Mar 21..30 (10 days), each rounded on its own line.
      const [invoice] = await h.dataSource.getRepository(Invoice).find();
      const seatDays = parseLineItems(invoice?.lineItems).flatMap((line) => (line.kind === 'seat' ? [line.activeDays] : []));
      expect(seatDays).toEqual([10, 10]);
      expect(change.body.prorationCents).toBe(161 + 161);
      expect(invoice?.periodEnd.toISOString()).toBe(iso('2026-03-31'));
    });

    it('an invited-but-unaccepted employee is not billed at all', async () => {
      await withPlan('basic');
      await h.inviteEmployee(adminSession);
      await travelTo('2026-03-21T09:00:00Z');

      const change = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }).expect(200);

      expect(change.body.prorationCents).toBe(0);
    });
  });
});
