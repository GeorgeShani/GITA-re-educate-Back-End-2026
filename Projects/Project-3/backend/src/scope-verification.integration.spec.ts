import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, DEFAULT_PASSWORD, type SessionBody } from '#test/support/app-harness.js';
import { BillingCycleService } from '#/billing/cycle/billing-cycle.service.js';
import { lineItemsSchema } from '#/billing/line-item.schema.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { FileAccessGrant } from '#/files/file-access-grant.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { ApiKey } from '#/api-keys/api-key.entity.js';
import { User } from '#/database/entities/user.entity.js';

const at = (iso: string) => new Date(iso);
const statementSchema = z.object({ lineItems: lineItemsSchema, totalCents: z.number() });
const pageSchema = z.object({
  data: z.array(z.object({ id: z.string(), createdAt: z.string(), mimeType: z.string() })),
  meta: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
});

/**
 * SCOPE.md's *Verification* walk (steps 1-15), executed end to end against the real app: the
 * graded path as ONE story, in order, sharing state — register, activate, plan, invite (with
 * Google), restricted files and reports, ACL, the executable that is not a spreadsheet, prorated
 * billing, API keys, pagination, the audit/analytics/GraphQL agreement, removal, the billing
 * cycle, and a Premium overage.
 *
 * Not repeatable here, because they need infrastructure a test does not have: step 12 (the Observe
 * dashboard) and step 16 against Neon (`query-plan.integration.spec.ts` proves the index on the
 * test database). Step 13 (live status over a socket) is `realtime.integration.spec.ts`.
 */
describe('SCOPE.md verification walk (integration)', () => {
  let h: AppHarness;

  let admin: { email: string; companyId: string; userId: string };
  let adminSession: SessionBody;
  let giorgi: { userId: string; email: string; session: SessionBody };
  let second: { userId: string; session: SessionBody };
  let restrictedFileId: string;
  let giorgiKey: { id: string; key: string };

  beforeAll(async () => {
    h = await AppHarness.start();
    await h.reset();
  }, 120_000);
  afterAll(() => h.stop());

  const auth = (session: SessionBody) => h.bearer(session);
  const withKey = (key: string): [string, string] => ['Authorization', `Bearer ${key}`];

  it('1. register (5 fields) → login is blocked → the activation link → login works', async () => {
    const email = 'founder@acme.test';
    await h
      .http()
      .post('/auth/register-company')
      .send({ companyName: 'Acme Analytics', email, password: DEFAULT_PASSWORD, country: 'GE', industry: 'technology' })
      .expect(201);
    await h.drainTasks();

    const blocked = await h.http().post('/auth/login').send({ email, password: DEFAULT_PASSWORD }).expect(403);
    expect(blocked.body.message).toMatch(/not activated/);

    await h.http().get('/auth/activate').query({ token: h.mail.latestTokenTo(email) }).expect(200);
    adminSession = await h.login(email);
    const me = await h.http().get('/auth/me').set(...auth(adminSession)).expect(200);
    admin = { email, companyId: me.body.company.id, userId: me.body.user.id };
  });

  it('2. POST /files before a plan → 402; then choose Basic', async () => {
    const refused = await h.upload(adminSession).expect(402);
    expect(refused.body.message).toMatch(/plan/i);
    await h.http().post('/subscriptions/me').set(...auth(adminSession)).send({ plan: 'basic' }).expect(201);
  });

  it('3. invite → complete with a Google account whose address does NOT match → the invited user; employee: 403 on /employees, names only on members', async () => {
    // Ten days into the billing period, so step 7's proration is visible.
    h.clock.set(at('2026-03-11T12:00:00Z'));
    adminSession = await h.login(admin.email);

    const invited = await h.inviteEmployee(adminSession, { email: 'giorgi@acme.test', fullName: 'Giorgi B.' });
    const flow = await h.googleFlow({
      intent: 'invite',
      inviteToken: h.mail.latestTokenTo(invited.email),
      profile: { providerUserId: 'g-giorgi', email: 'giorgi.private@gmail.test', emailVerified: true },
    });
    const exchanged = await h.exchangeOAuthCode(flow.location.searchParams.get('code') ?? '');
    expect(exchanged.status).toBe(200);
    giorgi = { userId: invited.userId, email: invited.email, session: h.parseSession(exchanged.body) };

    const who = await h.http().get('/auth/me').set(...auth(giorgi.session)).expect(200);
    expect(who.body.user.id).toBe(invited.userId);

    await h.http().get('/employees').set(...auth(giorgi.session)).expect(403);
    const members = await h.http().get('/companies/me/members').set(...auth(giorgi.session)).expect(200);
    for (const member of members.body) expect(Object.keys(member).sort()).toEqual(['fullName', 'id']);

    const other = await h.inviteAndAccept(adminSession, admin.companyId, { fullName: 'Second Employee' });
    second = { userId: other.userId, session: other.session };
  });

  it('4. an employee’s restricted file: the report reaches ready; the admin sees it; a second employee gets 404', async () => {
    const uploaded = await h.upload(giorgi.session, { visibility: 'restricted', name: 'restricted.csv' }).expect(201);
    restrictedFileId = uploaded.body.id;
    await h.drainTasks();

    const report = await h.http().get(`/files/${restrictedFileId}/report`).set(...auth(giorgi.session)).expect(200);
    expect(report.body.status).toBe('ready');
    expect(report.body.metrics.rowCount).toBeGreaterThan(0);

    await h.http().get(`/files/${restrictedFileId}`).set(...auth(adminSession)).expect(200);
    await h.http().get(`/files/${restrictedFileId}`).set(...auth(second.session)).expect(404);
  });

  it('5. grant the second employee → they can read it → revoke → 404 again', async () => {
    await h
      .http()
      .patch(`/files/${restrictedFileId}`)
      .set(...auth(giorgi.session))
      .send({ grantedUserIds: [second.userId] })
      .expect(200);
    await h.http().get(`/files/${restrictedFileId}`).set(...auth(second.session)).expect(200);

    await h.http().patch(`/files/${restrictedFileId}`).set(...auth(giorgi.session)).send({ grantedUserIds: [] }).expect(200);
    await h.http().get(`/files/${restrictedFileId}`).set(...auth(second.session)).expect(404);
  });

  it('6. an executable renamed .csv is refused on its bytes, and writes no usage event', async () => {
    const before = await h.dataSource.getRepository(UsageEvent).count();
    await h.upload(giorgi.session, { name: 'invoice.csv', content: 'MZ\u0090\u0000\u0003\u0000\u0000\u0000\u0004\u0000' }).expect(400);
    expect(await h.dataSource.getRepository(UsageEvent).count()).toBe(before);
  });

  it('7. GET /billing/current: the seat line is $5 × active-days / period-days, not a flat $5', async () => {
    const response = await h.http().get('/billing/current').set(...auth(adminSession)).expect(200);
    const statement = statementSchema.parse(response.body);
    const seat = statement.lineItems.find((line) => line.kind === 'seat' && line.userId === giorgi.userId);

    // Joined Mar 11 of a 31-day March: days 11..31 = 21 of 31.
    expect(seat).toMatchObject({ activeDays: 21, periodDays: 31, unitCents: 500, amountCents: Math.round((500 * 21) / 31) });
    expect(seat?.amountCents).not.toBe(500);
  });

  it('14. an employee’s API key does the same upload as that employee; lastUsedAt updates; a key cannot mint keys', async () => {
    giorgiKey = await h.createApiKey(giorgi.session, { name: 'walk', scopes: ['files:read', 'files:write'] });

    const viaKey = await h.upload(giorgi.session, { bearer: giorgiKey.key, name: 'via-key.csv' }).expect(201);
    expect(viaKey.body.uploaderId).toBe(giorgi.userId);
    await h.drainTasks();
    const report = await h.http().get(`/files/${viaKey.body.id}/report`).set(...withKey(giorgiKey.key)).expect(200);
    expect(report.body.status).toBe('ready');

    expect((await h.dataSource.getRepository(ApiKey).findOneByOrFail({ id: giorgiKey.id })).lastUsedAt).not.toBeNull();
    await h.http().post('/api-keys').set(...withKey(giorgiKey.key)).send({ name: 'more', scopes: ['files:read'] }).expect(403);
  });

  it('15. five more CSVs: following meta.nextCursor covers every file once, and sort + filter take effect', async () => {
    for (let index = 0; index < 5; index += 1) await h.upload(adminSession, { name: `extra-${index}.csv` }).expect(201);

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const query: Record<string, string> = { limit: '2' };
      if (cursor) query.cursor = cursor;
      const page = pageSchema.parse((await h.http().get('/files').query(query).set(...auth(adminSession)).expect(200)).body);
      seen.push(...page.data.map((file) => file.id));
      cursor = page.meta.nextCursor ?? undefined;
    } while (cursor);

    const visible = await h.dataSource.getRepository(FileAsset).count({ where: { companyId: admin.companyId } });
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(visible);

    const sorted = pageSchema.parse(
      (await h.http().get('/files').query({ sort: '-createdAt', mimeType: 'text/csv' }).set(...auth(adminSession)).expect(200)).body,
    );
    expect(sorted.data.every((file) => file.mimeType === 'text/csv')).toBe(true);
    const times = sorted.data.map((file) => file.createdAt);
    expect(times).toEqual([...times].sort().reverse());
  });

  it('11. the audit trail is correlated, and analytics over REST and GraphQL are the same numbers', async () => {
    const audit = await h.http().get('/audit').query({ limit: '100' }).set(...auth(adminSession)).expect(200);
    const actions: string[] = audit.body.data.map((entry: { action: string }) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['employee.invited', 'employee.accepted_invite', 'file.uploaded', 'file.access_changed', 'api_key.created']));
    const upload = audit.body.data.find((entry: { action: string }) => entry.action === 'file.uploaded');
    expect(upload.correlationId).toEqual(expect.any(String));

    const rest = (await h.http().get('/analytics/usage').set(...auth(adminSession)).expect(200)).body;
    const graphql = await h
      .http()
      .post('/graphql')
      .set(...auth(adminSession))
      .send({ query: '{ usage { storage { liveFiles liveBytes uploadedBytesInRange } quota { used limit plan } byEmployee { userId files bytes } } }' })
      .expect(200);
    expect(graphql.body.errors).toBeUndefined();
    expect(graphql.body.data.usage.storage).toEqual(rest.storage);
    expect(graphql.body.data.usage.quota).toMatchObject({ used: rest.quota.used, limit: rest.quota.limit, plan: rest.quota.plan });
    expect(graphql.body.data.usage.byEmployee).toEqual(rest.byEmployee.map(({ userId, files, bytes }: { userId: string; files: number; bytes: number }) => ({ userId, files, bytes })));
  });

  it('9. removing an employee: disabled, out of members, key → 401, grants gone — the history still resolves to them', async () => {
    // Give Giorgi a grant to hold, then remove him on Mar 20.
    await h.upload(adminSession, { visibility: 'restricted', grantedUserIds: [giorgi.userId], name: 'granted.csv' }).expect(201);
    expect(await h.dataSource.getRepository(FileAccessGrant).countBy({ userId: giorgi.userId })).toBe(1);

    h.clock.set(at('2026-03-20T12:00:00Z'));
    adminSession = await h.login(admin.email);
    const removed = await h.http().delete(`/employees/${giorgi.userId}`).set(...auth(adminSession)).expect(200);
    expect(removed.body.status).toBe('disabled');

    const members = await h.http().get('/companies/me/members').set(...auth(adminSession)).expect(200);
    expect(members.body.map((member: { id: string }) => member.id)).not.toContain(giorgi.userId);
    await h.http().get('/files').set(...withKey(giorgiKey.key)).expect(401);
    expect(await h.dataSource.getRepository(FileAccessGrant).countBy({ userId: giorgi.userId })).toBe(0);

    expect(await h.dataSource.getRepository(FileAsset).countBy({ uploaderId: giorgi.userId })).toBeGreaterThan(0);
    expect(await h.dataSource.getRepository(AuditLogEntry).countBy({ actorUserId: giorgi.userId })).toBeGreaterThan(0);
    expect(await h.dataSource.getRepository(User).countBy({ id: giorgi.userId })).toBe(1);
  });

  it('10. the billing cycle finalizes the closing invoice with the seat line ending on the removal date', async () => {
    h.clock.set(at('2026-04-02T12:00:00Z'));
    const result = await h.app.get(BillingCycleService).runCycle();
    expect(result.failures).toBe(0);

    adminSession = await h.login(admin.email);
    const list = await h.http().get('/billing/invoices').set(...auth(adminSession)).expect(200);
    expect(list.body.meta.total).toBe(1);
    const invoice = await h.http().get(`/billing/invoices/${list.body.data[0].id}`).set(...auth(adminSession)).expect(200);
    const statement = statementSchema.parse(invoice.body);

    // Mar 11 .. Mar 19 = 9 of 31 days for the removed employee; the other one ran to the end.
    const removedSeat = statement.lineItems.find((line) => line.kind === 'seat' && line.userId === giorgi.userId);
    expect(removedSeat).toMatchObject({ activeDays: 9, periodDays: 31, amountCents: Math.round((500 * 9) / 31) });
    const remainingSeat = statement.lineItems.find((line) => line.kind === 'seat' && line.userId === second.userId);
    expect(remainingSeat).toMatchObject({ activeDays: 21, amountCents: Math.round((500 * 21) / 31) });
    expect(statement.totalCents).toBe(Math.round((500 * 9) / 31) + Math.round((500 * 21) / 31));

    // Running it again bills nothing twice.
    await h.app.get(BillingCycleService).runCycle();
    expect((await h.http().get('/billing/invoices').set(...auth(adminSession)).expect(200)).body.meta.total).toBe(1);
  });

  it('8. upgrade to Premium and upload past 1000: the $0.50 overage line, and the quota-warning header', async () => {
    await h.http().patch('/subscriptions/me').set(...auth(adminSession)).send({ plan: 'premium' }).expect(200);
    await h.seedUsage(admin.companyId, 1000, '2026-04-02');

    const over = await h.upload(adminSession, { name: 'one-too-many.csv' }).expect(201);
    expect(over.headers['x-gridline-quota-warning']).toMatch(/\$0\.50/);

    const statement = statementSchema.parse((await h.http().get('/billing/current').set(...auth(adminSession)).expect(200)).body);
    expect(statement.lineItems.find((line) => line.kind === 'overage')).toMatchObject({ files: 1, unitCents: 50, amountCents: 50 });
  });
});
