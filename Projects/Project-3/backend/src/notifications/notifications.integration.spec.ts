import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { connect, type Listener, settle } from '#test/support/socket-client.js';
import { xlsBytes } from '#test/support/spreadsheet-fixtures.js';
import { Invoice } from '#/billing/invoice.entity.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { NotificationsJanitor } from './notifications-janitor.service.js';
import { NotificationsService } from './notifications.service.js';
import { Notification } from './notification.entity.js';
import { QuotaAlert } from './quota-alert.entity.js';

const DAY = 86_400_000;

const notificationSchema = z
  .object({
    id: z.uuid(),
    type: z.string(),
    payload: z.record(z.string(), z.unknown()),
    readAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
const pageSchema = z.object({
  data: z.array(notificationSchema),
  meta: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
});

describe('notifications: the inbox, quota alerts and their producers (integration)', () => {
  let h: AppHarness;
  let url: string;
  let open: Listener[];

  beforeAll(async () => {
    h = await AppHarness.start();
    await h.app.listen(0);
    const address = h.app.getHttpServer().address();
    if (address === null || typeof address === 'string') throw new Error('the app is not listening on a port');
    url = `http://127.0.0.1:${address.port}`;
  }, 120_000);
  beforeEach(async () => {
    await h.reset();
    open = [];
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const listener of open) listener.close();
  });
  afterAll(() => h.stop());

  // ---- helpers ------------------------------------------------------------

  async function company(plan: 'free' | 'basic' | 'premium' = 'free') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session, companyId: admin.companyId };
  }

  async function join(session: SessionBody): Promise<Listener> {
    const listener = await connect(url, session.accessToken);
    open.push(listener);
    return listener;
  }

  const inbox = async (session: SessionBody, query: Record<string, string | number> = {}) =>
    pageSchema.parse((await h.http().get('/notifications').set(...h.bearer(session)).query(query).expect(200)).body);

  const rowsOf = (userId: string, type?: string) =>
    h.dataSource.getRepository(Notification).find({
      where: type ? { userId, type } : { userId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

  const uploadOk = async (session: SessionBody, options: Parameters<AppHarness['upload']>[1] = {}) =>
    z.object({ id: z.uuid() }).parse((await h.upload(session, options).expect(201)).body);

  const quotaEmails = (address: string) => h.mail.to(address).filter((mail) => /file quota/.test(mail.subject));

  // ---- quota alerts ----------------------------------------------------------

  describe('quota alerts', () => {
    it('tells the admin once at 80% (8 of 10) and once at 100%, by inbox and by email', async () => {
      const { admin, session } = await company('free');

      for (let i = 0; i < 7; i += 1) await uploadOk(session);
      await h.drainTasks();
      expect(await rowsOf(admin.userId, 'quota.threshold')).toHaveLength(0);
      expect(quotaEmails(admin.email)).toHaveLength(0);

      await uploadOk(session); // the 8th
      await h.drainTasks();
      const at80 = await rowsOf(admin.userId, 'quota.threshold');
      expect(at80).toHaveLength(1);
      expect(at80[0]?.payload).toEqual({
        threshold: 80,
        plan: 'free',
        periodKey: '2026-03-01',
        filesUsed: 8,
        filesLimit: 10,
        upgradeTo: 'basic',
      });
      expect(quotaEmails(admin.email)).toHaveLength(1);
      expect(quotaEmails(admin.email)[0]?.subject).toContain('80%');

      await uploadOk(session); // the 9th: nothing new
      await h.drainTasks();
      expect(await rowsOf(admin.userId, 'quota.threshold')).toHaveLength(1);
      expect(quotaEmails(admin.email)).toHaveLength(1);

      await uploadOk(session); // the 10th
      await h.drainTasks();
      const all = await rowsOf(admin.userId, 'quota.threshold');
      expect(all.map((row) => (z.object({ threshold: z.number() }).parse(row.payload)).threshold)).toEqual([80, 100]);
      const emails = quotaEmails(admin.email);
      expect(emails).toHaveLength(2);
      expect(emails[1]?.text).toContain('Uploads stop until 2026-04-01');
      expect(emails[1]?.text).toContain('basic');
    });

    it('goes to every admin and to nobody else', async () => {
      const { admin, session, companyId } = await company('basic');
      const employee = await h.inviteAndAccept(session, companyId);
      await h.seedUsage(companyId, 79, '2026-03-01');

      await uploadOk(session);
      await h.drainTasks();

      expect(await rowsOf(admin.userId, 'quota.threshold')).toHaveLength(1);
      expect(await rowsOf(employee.userId)).toHaveLength(0);
    });

    it('is decided by the unique (company, period, threshold) row, not by a crossing check', async () => {
      const { admin, session, companyId } = await company('free');
      // The 80% alert for this period already exists (say, an earlier upload that was later deleted).
      await h.dataSource.getRepository(QuotaAlert).insert({ companyId, periodKey: '2026-03-01', threshold: 80 });
      await h.seedUsage(companyId, 7, '2026-03-01');

      await uploadOk(session); // reaches 8 of 10
      await h.drainTasks();

      expect(await rowsOf(admin.userId, 'quota.threshold')).toHaveLength(0);
      expect(quotaEmails(admin.email)).toHaveLength(0);
    });

    it('fires again in a new billing period', async () => {
      const { admin, session, companyId } = await company('free');
      await h.seedUsage(companyId, 7, '2026-03-01');
      await uploadOk(session);
      expect(await rowsOf(admin.userId, 'quota.threshold')).toHaveLength(1);

      h.clock.advance(32 * DAY); // 2026-04-02: March's period has ended
      const later = await h.login(admin.email);
      await h.seedUsage(companyId, 7, '2026-04-01');
      await uploadOk(later);

      const rows = await rowsOf(admin.userId, 'quota.threshold');
      expect(rows).toHaveLength(2);
      expect(rows[1]?.payload).toMatchObject({ threshold: 80, periodKey: '2026-04-01' });
    });

    it('a Premium company past 100% is told uploads continue and what overage costs', async () => {
      const { admin, session, companyId } = await company('premium');
      await h.seedUsage(companyId, 999, '2026-03-01');

      await uploadOk(session); // 1000 of 1000: both thresholds at once
      await h.drainTasks();

      const thresholds = (await rowsOf(admin.userId, 'quota.threshold')).map(
        (row) => z.object({ threshold: z.number(), upgradeTo: z.null() }).parse(row.payload).threshold,
      );
      expect(thresholds.sort((a, b) => a - b)).toEqual([80, 100]);
      const hundred = quotaEmails(admin.email).find((mail) => /Uploads keep working/.test(mail.text));
      expect(hundred?.text).toContain('$0.50');
    });

    it('a rolled-back upload announces nothing: no notification, no alert row, no email, no socket event', async () => {
      const { admin, session, companyId } = await company('free');
      await h.seedUsage(companyId, 7, '2026-03-01');
      const listener = await join(session);

      const queue = h.app.get(TaskQueue);
      const real = queue.enqueue.bind(queue);
      const spy = vi.spyOn(queue, 'enqueue').mockImplementation(async (type, payload, options) => {
        // The alert (and its email) are written first; failing the report task rolls them all back.
        if (type === 'build_data_quality_report') throw new Error('boom');
        return real(type, payload, options);
      });
      await h.upload(session).expect(500);
      await h.drainTasks();
      await settle();

      expect(await rowsOf(admin.userId)).toHaveLength(0);
      expect(await h.dataSource.getRepository(QuotaAlert).count()).toBe(0);
      expect(quotaEmails(admin.email)).toHaveLength(0);
      expect(listener.of('notification.created')).toEqual([]);

      spy.mockRestore();
      await uploadOk(session); // the same upload, now allowed to commit
      await h.drainTasks();
      expect(await rowsOf(admin.userId, 'quota.threshold')).toHaveLength(1);
      // The committed upload also finishes its report, which is its own notification: pick out the alert.
      await listener.waitFor('notification.created', 2);
      const alerts = listener
        .of('notification.created')
        .filter((event) => z.object({ type: z.literal('quota.threshold') }).safeParse(event).success);
      expect(alerts).toHaveLength(1);
    });
  });

  // ---- producers ---------------------------------------------------------------

  describe('report notifications', () => {
    it('the uploader is told when the report is ready, and nobody else', async () => {
      const { admin, session, companyId } = await company('basic');
      const employee = await h.inviteAndAccept(session, companyId);

      const file = await uploadOk(employee.session, { name: 'sales.csv' });
      await h.drainTasks();

      const mine = await rowsOf(employee.userId, 'report.ready');
      expect(mine).toHaveLength(1);
      expect(mine[0]?.payload).toEqual({ fileId: file.id, fileName: 'sales.csv' });
      expect(await rowsOf(admin.userId, 'report.ready')).toHaveLength(0);
    });

    it('a report that fails for good says why; an unsupported .xls says nothing', async () => {
      const { admin, session } = await company('free');

      // The upload check reads the first 64 KB; the fault is after it, so the file is accepted.
      const csv = 'a,b\n' + 'x,y\n'.repeat(20_000) + '1,"never closed\n2,3\n';
      const broken = await uploadOk(session, { name: 'broken.csv', content: csv });
      await uploadOk(session, { name: 'old.xls', content: xlsBytes(), contentType: 'application/vnd.ms-excel' });
      await h.drainTasks();

      const failed = await rowsOf(admin.userId, 'report.failed');
      expect(failed).toHaveLength(1);
      expect(failed[0]?.payload).toMatchObject({ fileId: broken.id, fileName: 'broken.csv' });
      expect(JSON.stringify(failed[0]?.payload)).toMatch(/Quote Not Closed/);
      expect(await rowsOf(admin.userId, 'report.ready')).toHaveLength(0);
    });
  });

  describe('file.shared', () => {
    it('reaches the people a file is shared with on upload, not the uploader', async () => {
      const { session, companyId } = await company('basic');
      const uploader = await h.inviteAndAccept(session, companyId);
      const friend = await h.inviteAndAccept(session, companyId);

      const file = await uploadOk(uploader.session, {
        name: 'plan.csv',
        visibility: 'restricted',
        grantedUserIds: [friend.userId],
      });

      const got = await rowsOf(friend.userId, 'file.shared');
      expect(got).toHaveLength(1);
      expect(got[0]?.payload).toEqual({ fileId: file.id, fileName: 'plan.csv', sharedByUserId: uploader.userId });
      expect(await rowsOf(uploader.userId, 'file.shared')).toHaveLength(0);
    });

    it('a later share tells only the people newly added; removing someone tells nobody', async () => {
      const { session, companyId } = await company('basic');
      const uploader = await h.inviteAndAccept(session, companyId);
      const first = await h.inviteAndAccept(session, companyId);
      const second = await h.inviteAndAccept(session, companyId);
      const file = await uploadOk(uploader.session, { visibility: 'restricted', grantedUserIds: [first.userId] });

      await h
        .http()
        .patch(`/files/${file.id}`)
        .set(...h.bearer(uploader.session))
        .send({ grantedUserIds: [first.userId, second.userId] })
        .expect(200);
      expect(await rowsOf(first.userId, 'file.shared')).toHaveLength(1); // from the upload only
      expect(await rowsOf(second.userId, 'file.shared')).toHaveLength(1);

      await h
        .http()
        .patch(`/files/${file.id}`)
        .set(...h.bearer(uploader.session))
        .send({ grantedUserIds: [second.userId] })
        .expect(200);
      expect(await rowsOf(first.userId, 'file.shared')).toHaveLength(1);
      expect(await rowsOf(second.userId, 'file.shared')).toHaveLength(1);
    });

    it('an admin who shares a file with themself is not notified about their own action', async () => {
      const { admin, session, companyId } = await company('basic');
      const uploader = await h.inviteAndAccept(session, companyId);
      const file = await uploadOk(uploader.session, { visibility: 'restricted' });

      await h
        .http()
        .patch(`/files/${file.id}`)
        .set(...h.bearer(session))
        .send({ grantedUserIds: [admin.userId] })
        .expect(200);

      expect(await rowsOf(admin.userId, 'file.shared')).toHaveLength(0);
    });
  });

  describe('invoice.finalized', () => {
    it('goes to the admins when an invoice with something to pay is issued, and to no employee', async () => {
      const { admin, session, companyId } = await company('basic');
      const employee = await h.inviteAndAccept(session, companyId);
      h.clock.advance(10 * DAY);
      const later = await h.login(admin.email);

      await h.http().patch('/subscriptions/me').set(...h.bearer(later)).send({ plan: 'premium' }).expect(200);

      const invoice = await h.dataSource.getRepository(Invoice).findOneByOrFail({ companyId });
      expect(invoice.totalCents).toBeGreaterThan(0);
      const got = await rowsOf(admin.userId, 'invoice.finalized');
      expect(got).toHaveLength(1);
      expect(got[0]?.payload).toMatchObject({ invoiceId: invoice.id, totalCents: invoice.totalCents });
      expect(await rowsOf(employee.userId, 'invoice.finalized')).toHaveLength(0);
    });

    it('a $0 invoice is not worth an inbox entry', async () => {
      const { admin, companyId } = await company('free');
      h.clock.advance(10 * DAY);
      const later = await h.login(admin.email);

      await h.http().patch('/subscriptions/me').set(...h.bearer(later)).send({ plan: 'basic' }).expect(200);

      expect((await h.dataSource.getRepository(Invoice).findOneByOrFail({ companyId })).totalCents).toBe(0);
      expect(await rowsOf(admin.userId, 'invoice.finalized')).toHaveLength(0);
    });
  });

  // ---- realtime ------------------------------------------------------------------

  describe('live push', () => {
    it('arrives on the owner’s socket only, and only for what committed', async () => {
      const { session, companyId } = await company('basic');
      const uploader = await h.inviteAndAccept(session, companyId);
      const friend = await h.inviteAndAccept(session, companyId);
      const bystander = await h.inviteAndAccept(session, companyId);
      const friends = await join(friend.session);
      const others = await join(bystander.session);
      const admins = await join(session);

      const file = await uploadOk(uploader.session, { visibility: 'restricted', grantedUserIds: [friend.userId] });

      const [event] = await friends.waitFor('notification.created');
      expect(event).toMatchObject({ type: 'file.shared', readAt: null, payload: { fileId: file.id } });
      await settle();
      expect(others.of('notification.created')).toEqual([]);
      expect(admins.of('notification.created')).toEqual([]);
    });

    it('tells the admin’s screens about a quota alert as it happens', async () => {
      const { session, companyId } = await company('free');
      await h.seedUsage(companyId, 7, '2026-03-01');
      const admins = await join(session);

      await uploadOk(session);

      const [event] = await admins.waitFor('notification.created');
      expect(event).toMatchObject({ type: 'quota.threshold', payload: { threshold: 80, filesUsed: 8 } });
    });
  });

  // ---- the routes ------------------------------------------------------------------

  describe('GET /notifications and friends', () => {
    async function seed(userId: string, companyId: string, count: number): Promise<string[]> {
      const service = h.app.get(NotificationsService);
      for (let i = 0; i < count; i += 1) {
        await service.notify(h.dataSource.manager, companyId, [userId], {
          type: 'report.ready',
          payload: { fileId: randomUUID(), fileName: `n${i}.csv` },
        });
      }
      return (await rowsOf(userId)).map((row) => row.id);
    }

    it('lists your own inbox newest first, and walks it by cursor with no duplicates or gaps', async () => {
      const { admin, session, companyId } = await company();
      const ids = await seed(admin.userId, companyId, 25);

      const seen: string[] = [];
      let cursor: string | undefined;
      for (let pages = 0; pages < 5; pages += 1) {
        const page = await inbox(session, { limit: 10, ...(cursor ? { cursor } : {}) });
        seen.push(...page.data.map((item) => item.id));
        if (!page.meta.hasMore) break;
        cursor = page.meta.nextCursor ?? undefined;
      }

      expect(seen).toHaveLength(25);
      expect(new Set(seen).size).toBe(25);
      expect(seen).toEqual([...ids].reverse());
    });

    it('filters to unread, counts them, and marks one read idempotently (keeping the first readAt)', async () => {
      const { admin, session, companyId } = await company();
      const [first, second] = await seed(admin.userId, companyId, 2);
      const count = async () =>
        z.object({ count: z.number() }).parse((await h.http().get('/notifications/unread-count').set(...h.bearer(session)).expect(200)).body)
          .count;
      expect(await count()).toBe(2);

      const readAt = h.clock.now().toISOString();
      const marked = await h.http().post(`/notifications/${first}/read`).set(...h.bearer(session)).expect(200);
      expect(notificationSchema.parse(marked.body).readAt).toBe(readAt);
      expect(await count()).toBe(1);

      h.clock.advance(3_600_000);
      const later = await h.login(admin.email); // the first token expires after 15 minutes
      const again = await h.http().post(`/notifications/${first}/read`).set(...h.bearer(later)).expect(200);
      expect(notificationSchema.parse(again.body).readAt).toBe(readAt);

      const unread = await inbox(later, { unread: 'true' });
      expect(unread.data.map((item) => item.id)).toEqual([second]);
      // `unread=false` is "no filter", not "only read ones": both are still listed.
      expect((await inbox(later, { unread: 'false' })).data).toHaveLength(2);
    });

    it('read-all marks everything once and reports how many', async () => {
      const { admin, session, companyId } = await company();
      await seed(admin.userId, companyId, 3);

      const first = await h.http().post('/notifications/read-all').set(...h.bearer(session)).expect(200);
      const second = await h.http().post('/notifications/read-all').set(...h.bearer(session)).expect(200);

      expect(first.body).toEqual({ updated: 3 });
      expect(second.body).toEqual({ updated: 0 });
      expect((await inbox(session, { unread: 'true' })).data).toEqual([]);
    });

    it('nobody reads or marks another person’s notifications — an admin included — and it is a 404, not a 403', async () => {
      const { admin, session, companyId } = await company('basic');
      const employee = await h.inviteAndAccept(session, companyId);
      const [theirs] = await seed(employee.userId, companyId, 1);
      const [mine] = await seed(admin.userId, companyId, 1);

      expect((await inbox(session)).data.map((item) => item.id)).toEqual([mine]);
      expect((await inbox(employee.session)).data.map((item) => item.id)).toEqual([theirs]);
      await h.http().post(`/notifications/${theirs}/read`).set(...h.bearer(session)).expect(404);
      await h.http().post(`/notifications/${mine}/read`).set(...h.bearer(employee.session)).expect(404);
      expect((await rowsOf(employee.userId))[0]?.readAt).toBeNull();
      await h.http().post(`/notifications/${randomUUID()}/read`).set(...h.bearer(session)).expect(404);
    });

    it('never crosses companies', async () => {
      const first = await company();
      const second = await company();
      const [theirs] = await seed(second.admin.userId, second.companyId, 1);

      expect((await inbox(first.session)).data).toEqual([]);
      await h.http().post(`/notifications/${theirs}/read`).set(...h.bearer(first.session)).expect(404);
    });

    it('is closed to API keys, needs a session, and rejects a malformed id or filter', async () => {
      const { session } = await company();
      const { key } = await h.createApiKey(session, { scopes: ['files:read', 'files:write'] });

      await h.http().get('/notifications').set('Authorization', `Bearer ${key}`).expect(403);
      await h.http().post('/notifications/read-all').set('Authorization', `Bearer ${key}`).expect(403);
      await h.http().get('/notifications').expect(401);
      await h.http().post('/notifications/not-a-uuid/read').set(...h.bearer(session)).expect(400);
      await h.http().get('/notifications').set(...h.bearer(session)).query({ unread: 'maybe' }).expect(400);
      await h.http().get('/notifications').set(...h.bearer(session)).query({ limit: 500 }).expect(400);
    });
  });

  // ---- writing ---------------------------------------------------------------------

  describe('NotificationsService.notify', () => {
    const content = { type: 'report.ready', payload: { fileId: randomUUID(), fileName: 'x.csv' } } as const;

    it('skips a removed person and anyone in another company', async () => {
      const { session, companyId } = await company('basic');
      const employee = await h.inviteAndAccept(session, companyId);
      const stranger = await company();
      await h.http().delete(`/employees/${employee.userId}`).set(...h.bearer(session)).expect(200);
      const service = h.app.get(NotificationsService);

      const written = await service.notify(h.dataSource.manager, companyId, [employee.userId, stranger.admin.userId], content);

      expect(written).toBe(0);
      expect(await h.dataSource.getRepository(Notification).count()).toBe(0);
    });

    it('writes one row per active recipient, even when a person is listed twice', async () => {
      const { admin, companyId } = await company();
      const service = h.app.get(NotificationsService);

      expect(await service.notify(h.dataSource.manager, companyId, [admin.userId, admin.userId], content)).toBe(1);
      expect(await h.dataSource.getRepository(Notification).count()).toBe(1);
    });
  });

  // ---- retention -------------------------------------------------------------------

  describe('the janitor', () => {
    it('removes read notifications older than 90 days and keeps unread and recent ones', async () => {
      const { admin, session, companyId } = await company();
      const service = h.app.get(NotificationsService);
      for (let i = 0; i < 3; i += 1) {
        await service.notify(h.dataSource.manager, companyId, [admin.userId], {
          type: 'report.ready',
          payload: { fileId: randomUUID(), fileName: `${i}.csv` },
        });
      }
      const [read, unread, alsoRead] = (await rowsOf(admin.userId)).map((row) => row.id);
      await h.http().post(`/notifications/${read}/read`).set(...h.bearer(session)).expect(200);
      const readAt = h.clock.now();
      h.clock.advance(60 * DAY);
      const later = await h.login(admin.email);
      await h.http().post(`/notifications/${alsoRead}/read`).set(...h.bearer(later)).expect(200);
      const janitor = h.app.get(NotificationsJanitor);

      expect(await janitor.purge(new Date(readAt.getTime() + 89 * DAY))).toBe(0);
      expect(await janitor.purge(new Date(readAt.getTime() + 91 * DAY))).toBe(1);
      expect((await rowsOf(admin.userId)).map((row) => row.id).sort()).toEqual([unread, alsoRead].sort());

      // Read 60 days after the first, so it goes 60 days later; the unread one never does.
      expect(await janitor.purge(new Date(readAt.getTime() + 500 * DAY))).toBe(1);
      expect((await rowsOf(admin.userId)).map((row) => row.id)).toEqual([unread]);
    });
  });
});
