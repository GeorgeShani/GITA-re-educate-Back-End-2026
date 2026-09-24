import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, type RegisteredAccount, type SessionBody } from '#test/support/app-harness.js';
import { Invoice } from '#/billing/invoice.entity.js';
import { parseLineItems } from '#/billing/line-item.schema.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { SubscriptionChange } from './subscription-change.entity.js';
import { Subscription } from './subscription.entity.js';

const iso = (value: string) => new Date(value).toISOString();

describe('plans and subscriptions (integration)', () => {
  let h: AppHarness;
  let admin: RegisteredAccount;
  let session: SessionBody;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    admin = await h.registerAndActivate();
    session = await h.login(admin.email);
  });

  afterAll(() => h.stop());

  /** Moves the fake clock and signs in again — the 15-minute access token would have expired. */
  async function travelTo(instant: string): Promise<void> {
    h.clock.set(new Date(instant));
    session = await h.login(admin.email);
  }

  const auth = () => h.bearer(session);
  const subscriptions = () => h.dataSource.getRepository(Subscription);
  const changes = () => h.dataSource.getRepository(SubscriptionChange);
  const invoices = () => h.dataSource.getRepository(Invoice);

  describe('GET /subscriptions/plans', () => {
    it('is public and lists the three plans with the brief’s numbers', async () => {
      const response = await h.http().get('/subscriptions/plans').expect(200);

      expect(response.body).toEqual([
        { plan: 'free', maxEmployees: 0, maxSeats: 1, filesPerPeriod: 10, seatPriceCents: 0, basePriceCents: 0, overagePerFileCents: null },
        { plan: 'basic', maxEmployees: 10, maxSeats: 11, filesPerPeriod: 100, seatPriceCents: 500, basePriceCents: 0, overagePerFileCents: null },
        { plan: 'premium', maxEmployees: null, maxSeats: null, filesPerPeriod: 1000, seatPriceCents: 0, basePriceCents: 30_000, overagePerFileCents: 50 },
      ]);
    });
  });

  describe('before a plan is chosen', () => {
    it('GET /subscriptions/me is 404 and points at plan selection', async () => {
      const response = await h.http().get('/subscriptions/me').set(...auth()).expect(404);

      expect(response.body.message).toMatch(/POST \/subscriptions\/me/);
    });

    it('PATCH /subscriptions/me is 404 — there is nothing to change', async () => {
      await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'basic' }).expect(404);
    });
  });

  describe('POST /subscriptions/me — the mandatory first choice', () => {
    it.each(['free', 'basic', 'premium'] as const)('%s: opens a period anchored to today', async (plan) => {
      const response = await h.http().post('/subscriptions/me').set(...auth()).send({ plan }).expect(201);

      expect(response.body).toMatchObject({
        plan,
        billingAnchorDay: 1,
        period: { start: iso('2026-03-01'), end: iso('2026-04-01'), key: '2026-03-01', days: 31 },
        usage: { files: 0, employees: 0, seats: 1 },
        nextDueDate: iso('2026-04-01'),
      });
    });

    it('reports the plan’s limits', async () => {
      const response = await h.http().post('/subscriptions/me').set(...auth()).send({ plan: 'basic' }).expect(201);

      expect(response.body.limits).toEqual({ maxEmployees: 10, maxSeats: 11, filesPerPeriod: 100 });
    });

    it('anchors to the day of the month it is chosen on, clamped for a short month', async () => {
      await travelTo('2026-01-31T10:00:00Z');

      const response = await h.http().post('/subscriptions/me').set(...auth()).send({ plan: 'basic' }).expect(201);

      expect(response.body).toMatchObject({
        billingAnchorDay: 31,
        period: { start: iso('2026-01-31'), end: iso('2026-02-28'), days: 28 },
      });
    });

    it('records the choice in the change history and the audit trail', async () => {
      await h.subscribe(session, 'premium');

      const [change] = await changes().find();
      expect(change).toMatchObject({ fromPlan: null, toPlan: 'premium', prorationCents: 0 });
      expect(change?.effectiveAt.toISOString()).toBe(h.clock.now().toISOString());
      const audit = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({ action: 'subscription.created' });
      expect(audit).toMatchObject({ companyId: admin.companyId, actorUserId: admin.userId, metadata: { plan: 'premium' } });
    });

    it('rejects a second choice with 409, leaving the first intact', async () => {
      await h.subscribe(session, 'basic');

      const response = await h.http().post('/subscriptions/me').set(...auth()).send({ plan: 'premium' }).expect(409);

      expect(response.body.message).toMatch(/PATCH \/subscriptions\/me/);
      expect((await subscriptions().findOneByOrFail({ companyId: admin.companyId })).plan).toBe('basic');
    });

    it('lets exactly one of two simultaneous first choices win', async () => {
      const statuses = (
        await Promise.all([
          h.http().post('/subscriptions/me').set(...auth()).send({ plan: 'basic' }),
          h.http().post('/subscriptions/me').set(...auth()).send({ plan: 'premium' }),
        ])
      )
        .map((response) => response.status)
        .sort();

      expect(statuses).toEqual([201, 409]);
      expect(await subscriptions().count()).toBe(1);
      expect(await changes().count()).toBe(1);
    });

    it.each([
      ['an unknown plan', { plan: 'enterprise' }],
      ['no plan', {}],
      ['an extra field', { plan: 'basic', price: 0 }],
    ])('rejects %s', async (_name, body) => {
      await h.http().post('/subscriptions/me').set(...auth()).send(body).expect(400);
    });
  });

  describe('who may do what', () => {
    it('lets an employee READ the subscription but not choose or change it', async () => {
      await h.subscribe(session, 'basic');
      const employee = await h.seedEmployee(admin.companyId);
      const employeeSession = await h.login(employee.email);
      const asEmployee = h.bearer(employeeSession);

      await h.http().get('/subscriptions/me').set(...asEmployee).expect(200);
      await h.http().patch('/subscriptions/me').set(...asEmployee).send({ plan: 'premium' }).expect(403);
      expect((await subscriptions().findOneByOrFail({ companyId: admin.companyId })).plan).toBe('basic');
    });

    it('forbids an employee from making the first choice', async () => {
      const employee = await h.seedEmployee(admin.companyId);
      const employeeSession = await h.login(employee.email);

      await h.http().post('/subscriptions/me').set(...h.bearer(employeeSession)).send({ plan: 'basic' }).expect(403);
      expect(await subscriptions().count()).toBe(0);
    });

    it('requires authentication for everything except the catalog', async () => {
      await h.http().get('/subscriptions/me').expect(401);
      await h.http().post('/subscriptions/me').send({ plan: 'basic' }).expect(401);
      await h.http().patch('/subscriptions/me').send({ plan: 'basic' }).expect(401);
    });

    it('is scoped to the caller’s own company', async () => {
      await h.subscribe(session, 'basic');
      const rival = await h.registerAndActivate({ companyName: 'Rival' });
      const rivalSession = await h.login(rival.email);

      // The rival has no plan of its own — it does not see Acme's.
      await h.http().get('/subscriptions/me').set(...h.bearer(rivalSession)).expect(404);
      await h.subscribe(rivalSession, 'premium');
      const mine = await h.http().get('/subscriptions/me').set(...auth()).expect(200);
      expect(mine.body.plan).toBe('basic');
    });
  });

  describe('GET /subscriptions/me — usage', () => {
    it('counts files this period, and seats held: invited + active employees, not disabled', async () => {
      await h.subscribe(session, 'basic');
      await h.seedUsage(admin.companyId, 7, '2026-03-01');
      await h.seedUsage(admin.companyId, 3, '2026-02-01'); // last period — not counted
      await h.seedEmployee(admin.companyId, { status: 'active' });
      await h.seedEmployee(admin.companyId, { status: 'invited' });
      await h.seedEmployee(admin.companyId, { status: 'disabled' });

      const response = await h.http().get('/subscriptions/me').set(...auth()).expect(200);

      expect(response.body.usage).toEqual({ files: 7, employees: 2, seats: 3 });
    });

    it('does not count another company’s usage', async () => {
      await h.subscribe(session, 'basic');
      const rival = await h.registerAndActivate({ companyName: 'Rival' });
      await h.seedUsage(rival.companyId, 50, '2026-03-01');
      await h.seedEmployee(rival.companyId);

      const response = await h.http().get('/subscriptions/me').set(...auth()).expect(200);

      expect(response.body.usage).toEqual({ files: 0, employees: 0, seats: 1 });
    });
  });

  describe('PATCH /subscriptions/me — changing plan', () => {
    it('rejects a change to the plan the company is already on', async () => {
      await h.subscribe(session, 'basic');

      await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'basic' }).expect(409);
      expect(await changes().count()).toBe(1);
    });

    it('closes the outgoing period with a prorated invoice and re-anchors to the switch day', async () => {
      await h.subscribe(session, 'basic');
      const employee = await h.seedEmployee(admin.companyId);
      await h.seedSeatInterval(admin.companyId, employee.userId, new Date('2026-03-01T00:00:00Z'), null);

      await travelTo('2026-03-11T09:00:00Z');
      const response = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }).expect(200);

      // Mar 1..10 = 10 of 31 days of one $5 seat: 500 * 10 / 31 = 161.3 -> 161.
      expect(response.body).toMatchObject({
        previousPlan: 'basic',
        prorationCents: 161,
        subscription: {
          plan: 'premium',
          billingAnchorDay: 11,
          period: { start: iso('2026-03-11'), end: iso('2026-04-11'), key: '2026-03-11', days: 31 },
          nextDueDate: iso('2026-04-11'),
        },
      });

      const [invoice] = await invoices().find();
      expect(invoice).toMatchObject({ companyId: admin.companyId, plan: 'basic', totalCents: 161, status: 'finalized' });
      expect(invoice?.periodStart.toISOString()).toBe(iso('2026-03-01'));
      expect(invoice?.periodEnd.toISOString()).toBe(iso('2026-03-11'));
      expect(invoice?.dueDate.toISOString()).toBe(iso('2026-03-11'));
      expect(parseLineItems(invoice?.lineItems)).toEqual([
        expect.objectContaining({ kind: 'seat', userId: employee.userId, activeDays: 10, amountCents: 161 }),
      ]);
    });

    it('writes the change row with the proration and the switch instant', async () => {
      await h.subscribe(session, 'premium');
      await travelTo('2026-03-11T09:00:00Z');

      await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'basic' }).expect(200);

      const history = await changes().find({ order: { effectiveAt: 'ASC' } });
      expect(history.map((c) => [c.fromPlan, c.toPlan, c.prorationCents])).toEqual([
        [null, 'premium', 0],
        ['premium', 'basic', 9_677], // 30000 * 10 / 31
      ]);
      expect(history[1]?.effectiveAt.toISOString()).toBe(iso('2026-03-11T09:00:00Z'));
    });

    it('keeps the plan and history in step, and bumps the version', async () => {
      await h.subscribe(session, 'basic');
      const before = await subscriptions().findOneByOrFail({ companyId: admin.companyId });

      await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }).expect(200);

      const after = await subscriptions().findOneByOrFail({ companyId: admin.companyId });
      expect(after.plan).toBe('premium');
      expect(after.version).toBeGreaterThan(before.version);
    });

    describe('every plan change prorates the outgoing plan', () => {
      // Switch on Mar 11 (10 of 31 days elapsed). Employee fixtures vary by pair
      // because the target plan's seat cap has to allow them.
      it.each([
        ['free', 'basic', 'none', 0],
        ['free', 'premium', 'none', 0],
        ['basic', 'premium', 'active-since-mar-1', 161],
        ['basic', 'free', 'disabled-mar-6', 81], // Mar 1..5 = 5 days: 500 * 5 / 31 = 80.6
        ['premium', 'basic', 'none', 9_677],
        ['premium', 'free', 'none', 9_677],
      ] as const)('%s -> %s (%s employee): %i cents', async (from, to, fixture, expected) => {
        await h.subscribe(session, from);
        if (fixture === 'active-since-mar-1') {
          const e = await h.seedEmployee(admin.companyId);
          await h.seedSeatInterval(admin.companyId, e.userId, new Date('2026-03-01'), null);
        }
        if (fixture === 'disabled-mar-6') {
          const e = await h.seedEmployee(admin.companyId, { status: 'disabled' });
          await h.seedSeatInterval(admin.companyId, e.userId, new Date('2026-03-01'), new Date('2026-03-06'));
        }
        await travelTo('2026-03-11T09:00:00Z');

        const response = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: to }).expect(200);

        expect(response.body.prorationCents).toBe(expected);
        const [invoice] = await invoices().find();
        expect(invoice).toMatchObject({ plan: from, totalCents: expected });
        expect(response.body.subscription.plan).toBe(to);
      });
    });

    it('bills nothing for a change on the period’s first day — and writes no invoice', async () => {
      await h.subscribe(session, 'basic');

      const response = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }).expect(200);

      expect(response.body.prorationCents).toBe(0);
      expect(await invoices().count()).toBe(0);
      expect(response.body.subscription.period.start).toBe(iso('2026-03-01'));
      expect(await changes().count()).toBe(2);
    });

    it('re-anchors billing to the day of the switch, clamped for a short month', async () => {
      await h.subscribe(session, 'basic');
      await travelTo('2026-03-31T08:00:00Z');

      const response = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }).expect(200);

      expect(response.body.subscription).toMatchObject({
        billingAnchorDay: 31,
        period: { start: iso('2026-03-31'), end: iso('2026-04-30'), days: 30 },
      });
    });

    it('invoices the days of a period that ended before the daily job ran, instead of dropping them', async () => {
      await h.subscribe(session, 'premium');
      // March ended on Apr 1; the change lands on Apr 3 with no rollover in between.
      await travelTo('2026-04-03T10:00:00Z');

      const response = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'basic' }).expect(200);

      const history = await invoices().find({ order: { periodStart: 'ASC' } });
      expect(history.map((i) => [i.periodStart.toISOString(), i.periodEnd.toISOString(), i.totalCents])).toEqual([
        [iso('2026-03-01'), iso('2026-04-01'), 30_000], // the whole of March
        [iso('2026-04-01'), iso('2026-04-03'), 2_000], // Apr 1..2: 30000 * 2 / 30
      ]);
      // The response reports the closing invoice, not the rolled-forward one.
      expect(response.body.prorationCents).toBe(2_000);
      expect(response.body.subscription.period.start).toBe(iso('2026-04-03'));
    });

    it('audits the change with from, to and the proration', async () => {
      await h.subscribe(session, 'premium');
      await travelTo('2026-03-11T09:00:00Z');
      await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'free' }).expect(200);

      const entry = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({ action: 'subscription.changed' });
      expect(entry.metadata).toEqual({ from: 'premium', to: 'free', prorationCents: 9_677 });
    });

    describe('the downgrade guard', () => {
      it('rejects a downgrade over the employee cap, naming how many to remove', async () => {
        await h.subscribe(session, 'premium');
        for (let i = 0; i < 12; i += 1) await h.seedEmployee(admin.companyId);

        const response = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'basic' }).expect(409);

        expect(response.body.message).toEqual([
          'Basic allows 10 employees, but the company has 12 — remove 2 first.',
        ]);
      });

      it('counts an invited employee — an invite holds a seat', async () => {
        await h.subscribe(session, 'basic');
        await h.seedEmployee(admin.companyId, { status: 'invited' });

        const response = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'free' }).expect(409);

        expect(response.body.message[0]).toMatch(/remove 1 first/);
      });

      it('does not count a disabled employee — their seat is free', async () => {
        await h.subscribe(session, 'basic');
        await h.seedEmployee(admin.companyId, { status: 'disabled' });

        await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'free' }).expect(200);
      });

      it('rejects a downgrade over the file quota, naming the count', async () => {
        await h.subscribe(session, 'premium');
        await h.seedUsage(admin.companyId, 150, '2026-03-01');

        const response = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'basic' }).expect(409);

        expect(response.body.message).toEqual([
          'Basic allows 100 files per period, but 150 have already been uploaded in this one.',
        ]);
      });

      it('reports every problem at once', async () => {
        await h.subscribe(session, 'premium');
        await h.seedUsage(admin.companyId, 40, '2026-03-01');
        await h.seedEmployee(admin.companyId);

        const response = await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'free' }).expect(409);

        expect(response.body.message).toHaveLength(2);
      });

      it('changes nothing when it refuses: no invoice, no history, same plan and period', async () => {
        await h.subscribe(session, 'premium');
        await h.seedEmployee(admin.companyId);
        await h.seedEmployee(admin.companyId);
        await travelTo('2026-03-11T09:00:00Z');
        await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'free' }).expect(409);

        const subscription = await subscriptions().findOneByOrFail({ companyId: admin.companyId });
        expect(subscription.plan).toBe('premium');
        expect(subscription.currentPeriodStart.toISOString()).toBe(iso('2026-03-01'));
        expect(await invoices().count()).toBe(0);
        expect(await changes().count()).toBe(1);
      });

      it('never blocks an upgrade, however much the company has used', async () => {
        await h.subscribe(session, 'basic');
        await h.seedUsage(admin.companyId, 500, '2026-03-01'); // far past Basic's 100

        await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }).expect(200);
      });

      it('will not let a Premium company with more files than the target allows leave', async () => {
        await h.subscribe(session, 'premium');
        await h.seedUsage(admin.companyId, 1_010, '2026-03-01');

        // So a plan-change invoice can never carry Premium overage: leaving Premium
        // with more files than the target allows is refused.
        await h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'basic' }).expect(409);
      });
    });

    describe('concurrency', () => {
      it('serialises two simultaneous changes to different plans — both succeed, in a consistent chain', async () => {
        await h.subscribe(session, 'basic');
        const before = await subscriptions().findOneByOrFail({ companyId: admin.companyId });

        const statuses = (
          await Promise.all([
            h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }),
            h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'free' }),
          ])
        ).map((response) => response.status);

        expect(statuses).toEqual([200, 200]);
        const history = await changes().find({ order: { createdAt: 'ASC', id: 'ASC' } });
        expect(history).toHaveLength(3);
        // Each change starts from where the previous one ended — no interleaving.
        expect(history[1]?.fromPlan).toBe(history[0]?.toPlan);
        expect(history[2]?.fromPlan).toBe(history[1]?.toPlan);
        const after = await subscriptions().findOneByOrFail({ companyId: admin.companyId });
        expect(after.plan).toBe(history[2]?.toPlan);
        expect(after.version).toBe(before.version + 2);
      });

      it('lets exactly one of two simultaneous changes to the SAME plan through', async () => {
        await h.subscribe(session, 'basic');

        const statuses = (
          await Promise.all([
            h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }),
            h.http().patch('/subscriptions/me').set(...auth()).send({ plan: 'premium' }),
          ])
        )
          .map((response) => response.status)
          .sort();

        expect(statuses).toEqual([200, 409]);
        expect(await changes().count()).toBe(2);
      });
    });
  });
});
