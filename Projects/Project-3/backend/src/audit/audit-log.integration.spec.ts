import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { AUDIT_ACTIONS } from '#/core/audit/audit-actions.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { BillingCycleService } from '#/billing/cycle/billing-cycle.service.js';

const entrySchema = z
  .object({
    id: z.uuid(),
    action: z.string(),
    actorUserId: z.uuid().nullable(),
    targetType: z.string().nullable(),
    targetId: z.uuid().nullable(),
    ip: z.string().nullable(),
    correlationId: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
const detailSchema = entrySchema.extend({ metadata: z.record(z.string(), z.unknown()) }).strict();
const pageSchema = z.object({
  data: z.array(entrySchema),
  meta: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
});

describe('GET /audit (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  // ---- helpers ------------------------------------------------------------

  async function company(plan: 'free' | 'basic' | 'premium' = 'basic') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session, companyId: admin.companyId };
  }

  const get = (session: SessionBody, path: string, query: Record<string, string | number> = {}) =>
    h.http().get(path).set(...h.bearer(session)).query(query);
  const list = async (session: SessionBody, query: Record<string, string | number> = {}) =>
    pageSchema.parse((await get(session, '/audit', query).expect(200)).body);

  /** Every audit entry for the company, newest first, straight from the table. */
  const stored = (companyId: string) =>
    h.dataSource.getRepository(AuditLogEntry).find({ where: { companyId }, order: { createdAt: 'DESC', id: 'DESC' } });

  const rename = (session: SessionBody, fullName: string) =>
    h.http().patch('/users/me').set(...h.bearer(session)).send({ fullName });

  // ---- access -------------------------------------------------------------

  describe('access', () => {
    it('needs a signed-in user', async () => {
      await h.http().get('/audit').expect(401);
      await h.http().get(`/audit/${randomUUID()}`).expect(401);
    });

    it('is 403 for an employee, on the list and on a single entry', async () => {
      const { session, companyId } = await company();
      const employee = await h.inviteAndAccept(session, companyId);
      const [entry] = await stored(companyId);

      await get(employee.session, '/audit').expect(403);
      await get(employee.session, `/audit/${entry?.id}`).expect(403);
    });

    it('a malformed id is 400, an unknown one 404', async () => {
      const { session } = await company();
      await get(session, '/audit/nope').expect(400);
      await get(session, `/audit/${randomUUID()}`).expect(404);
    });

    it('cannot be edited or deleted through the API', async () => {
      const { session, companyId } = await company();
      const [entry] = await stored(companyId);

      await h.http().patch(`/audit/${entry?.id}`).set(...h.bearer(session)).send({ action: 'x' }).expect(404);
      await h.http().delete(`/audit/${entry?.id}`).set(...h.bearer(session)).expect(404);
      await h.http().post('/audit').set(...h.bearer(session)).send({}).expect(404);
    });
  });

  // ---- shape --------------------------------------------------------------

  describe('the list and the detail', () => {
    it('lists newest first, and never carries `metadata`', async () => {
      const { session, companyId } = await company();
      await rename(session, 'Renamed Admin').expect(200);

      const page = await list(session);

      expect(page.data.map((entry) => entry.id)).toEqual((await stored(companyId)).map((row) => row.id));
      expect(page.data[0]?.action).toBe('user.profile_updated');
      for (const entry of page.data) expect(Object.keys(entry)).not.toContain('metadata');
    });

    it('the single-entry read includes `metadata`', async () => {
      const { session } = await company();
      const upload = await h.upload(session, { name: 'quarterly.csv' }).expect(201);
      const [entry] = (await list(session, { action: 'file.uploaded' })).data;

      const detail = detailSchema.parse((await get(session, `/audit/${entry?.id}`).expect(200)).body);

      expect(detail).toMatchObject({ action: 'file.uploaded', targetType: 'file', targetId: upload.body.id });
      expect(detail.metadata).toMatchObject({ originalName: 'quarterly.csv', mimeType: 'text/csv', visibility: 'company' });
    });

    it('records where the request came from', async () => {
      const { session } = await company();
      await rename(session, 'Somebody').expect(200);

      const [entry] = (await list(session)).data;
      expect(entry?.ip).toBeTruthy();
      expect(entry?.correlationId).toBeTruthy();
    });

    it('every action it reports is in the registry', async () => {
      const { session } = await company('basic');
      await h.inviteEmployee(session);
      await h.upload(session).expect(201);

      const actions = (await list(session, { limit: 100 })).data.map((entry) => entry.action);

      expect(actions.length).toBeGreaterThan(4);
      for (const action of actions) expect(AUDIT_ACTIONS).toContain(action);
    });
  });

  // ---- pagination ---------------------------------------------------------

  describe('cursor pagination', () => {
    it('walks 30+ real entries in pages of 7 with no duplicates and no gaps', async () => {
      const { session, companyId } = await company();
      for (let i = 0; i < 30; i += 1) await rename(session, `Name ${i}`).expect(200);
      const expected = (await stored(companyId)).map((row) => row.id);
      expect(expected.length).toBeGreaterThanOrEqual(30);

      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      for (; pages < 30; pages += 1) {
        const page = await list(session, cursor ? { limit: 7, cursor } : { limit: 7 });
        seen.push(...page.data.map((entry) => entry.id));
        if (!page.meta.hasMore) break;
        cursor = page.meta.nextCursor ?? undefined;
      }

      expect(new Set(seen).size, 'a row appeared twice').toBe(seen.length);
      expect(seen).toEqual(expected);
      expect(pages + 1).toBe(Math.ceil(expected.length / 7));
    });

    it.each<Record<string, string | number>>([{ limit: 0 }, { limit: 101 }, { cursor: '!!not-a-cursor' }])('rejects %j', async (query) => {
      const { session } = await company();
      await get(session, '/audit', query).expect(400);
    });

    it('an empty page for a filter that matches nothing', async () => {
      const { session } = await company();
      expect(await list(session, { action: 'file.deleted' })).toEqual({ data: [], meta: { nextCursor: null, hasMore: false } });
    });
  });

  // ---- filtering ----------------------------------------------------------

  describe('filters', () => {
    it('by action', async () => {
      const { session } = await company();
      await rename(session, 'A').expect(200);
      await rename(session, 'B').expect(200);

      const page = await list(session, { action: 'user.profile_updated' });

      expect(page.data).toHaveLength(2);
      expect(page.data.every((entry) => entry.action === 'user.profile_updated')).toBe(true);
    });

    it('by who did it — an employee’s actions, not the admin’s', async () => {
      const { session, companyId, admin } = await company();
      const employee = await h.inviteAndAccept(session, companyId);
      await h.upload(employee.session).expect(201);
      await h.upload(session).expect(201);

      const theirs = await list(session, { actorUserId: employee.userId });
      const mine = await list(session, { actorUserId: admin.userId });

      expect(theirs.data.map((entry) => entry.action).sort()).toEqual(['employee.accepted_invite', 'file.uploaded']);
      expect(mine.data.every((entry) => entry.actorUserId === admin.userId)).toBe(true);
      expect(mine.data.some((entry) => entry.action === 'file.uploaded')).toBe(true);
    });

    it('by the kind of thing acted on', async () => {
      const { session } = await company();
      await h.upload(session).expect(201);

      const files = await list(session, { targetType: 'file' });
      expect(files.data.map((entry) => entry.action)).toEqual(['file.uploaded']);
    });

    it('by time: `from` is inclusive, `to` exclusive', async () => {
      const { session, companyId } = await company();
      const rows = (await stored(companyId)).reverse(); // oldest first
      const cut = rows[Math.floor(rows.length / 2)];
      if (!cut) throw new Error('no audit rows');

      const since = await list(session, { from: cut.createdAt.toISOString(), limit: 100 });
      const before = await list(session, { to: cut.createdAt.toISOString(), limit: 100 });

      expect(since.data.every((entry) => new Date(entry.createdAt) >= cut.createdAt)).toBe(true);
      expect(before.data.every((entry) => new Date(entry.createdAt) < cut.createdAt)).toBe(true);
      expect(since.data.length + before.data.length).toBe(rows.length);
    });

    it('filters combine, and only ever narrow', async () => {
      const { session, companyId } = await company();
      const employee = await h.inviteAndAccept(session, companyId);
      await h.upload(employee.session).expect(201);

      const page = await list(session, { actorUserId: employee.userId, action: 'file.uploaded', targetType: 'file' });
      expect(page.data).toHaveLength(1);
      expect((await list(session, { actorUserId: employee.userId, action: 'file.deleted' })).data).toEqual([]);
    });

    it.each([
      ['an action that is not in the registry', { action: 'file.exploded' }],
      ['a malformed actor id', { actorUserId: 'me' }],
      ['a malformed date', { from: 'yesterday' }],
      ['an unknown parameter', { companyId: randomUUID() }],
    ])('rejects %s', async (_name, query) => {
      const { session } = await company();
      await get(session, '/audit', query).expect(400);
    });
  });

  // ---- isolation ----------------------------------------------------------

  describe('tenancy', () => {
    it('never shows another company’s entries, on the list or by id', async () => {
      const mine = await company();
      const other = await company();
      await h.upload(other.session).expect(201);
      const [theirs] = await stored(other.companyId);

      const page = await list(mine.session, { limit: 100 });

      expect(page.data.some((entry) => entry.id === theirs?.id)).toBe(false);
      const ids = new Set((await stored(mine.companyId)).map((row) => row.id));
      expect(page.data.every((entry) => ids.has(entry.id))).toBe(true);
      await get(mine.session, `/audit/${theirs?.id}`).expect(404);
    });
  });

  // ---- what the trail says ------------------------------------------------

  describe('the trail of a real flow', () => {
    it('register → activate → plan → invite → accept → upload appear in that order, attributed correctly', async () => {
      const admin = await h.registerAndActivate();
      const session = await h.login(admin.email);
      await h.subscribe(session, 'basic');
      const employee = await h.inviteAndAccept(session, admin.companyId);
      await h.upload(employee.session).expect(201);

      const ascending = (await list(session, { limit: 100 })).data.reverse();

      expect(ascending.map((entry) => entry.action)).toEqual([
        'company.registered',
        'company.activated',
        'subscription.created',
        'employee.invited',
        'employee.accepted_invite',
        'file.uploaded',
      ]);
      expect(ascending.map((entry) => entry.actorUserId)).toEqual([
        admin.userId,
        admin.userId,
        admin.userId,
        admin.userId,
        employee.userId,
        employee.userId,
      ]);
    });

    it('entries written by ONE request share a correlation id; different requests do not', async () => {
      const { admin, session, companyId } = await company('basic');
      await h.inviteAndAccept(session, companyId);
      // Not on the period's first day: a change then closes nothing (the switch day belongs
      // to the new plan), so there would be no invoice entry to correlate.
      h.clock.advance(3 * 86_400_000);
      const fresh = await h.login(admin.email);

      await h.http().patch('/subscriptions/me').set(...h.bearer(fresh)).send({ plan: 'premium' }).expect(200);

      // A plan change writes the change AND closes the outgoing period's invoice: two entries.
      const changed = (await list(fresh, { limit: 100 })).data.filter((entry) =>
        ['subscription.changed', 'billing.invoice_finalized'].includes(entry.action),
      );
      expect(changed).toHaveLength(2);
      expect(changed[0]?.correlationId).toBeTruthy();
      expect(changed[0]?.correlationId).toBe(changed[1]?.correlationId);
      const created = (await list(fresh, { action: 'subscription.created' })).data[0];
      expect(created?.correlationId).not.toBe(changed[0]?.correlationId);
    });

    it('carries an inbound X-Correlation-Id through to the entry', async () => {
      const { session } = await company();
      const correlationId = randomUUID();

      await h.upload(session).set('X-Correlation-Id', correlationId).expect(201);

      const [entry] = (await list(session, { action: 'file.uploaded' })).data;
      expect(entry?.correlationId).toBe(correlationId);
    });

    it('the billing cycle writes a system entry with no actor', async () => {
      const { admin } = await company('premium');
      h.clock.set(new Date('2026-04-01T00:10:00.000Z'));
      await h.app.get(BillingCycleService).runCycle();
      const session = await h.login(admin.email);

      const [entry] = (await list(session, { action: 'billing.invoice_finalized' })).data;

      expect(entry).toMatchObject({ actorUserId: null, targetType: 'invoice' });
    });
  });
});
