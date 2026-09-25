import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { connect, type Listener, settle } from '#test/support/socket-client.js';
import { xlsBytes } from '#test/support/spreadsheet-fixtures.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { Notification } from '#/notifications/notification.entity.js';
import { QualityRule } from './quality-rule.entity.js';

const ruleSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    kind: z.string(),
    columnName: z.string().nullable(),
    params: z.record(z.string(), z.unknown()),
    severity: z.string(),
    enabled: z.boolean(),
    createdByUserId: z.uuid(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
const rulePageSchema = z.object({
  data: z.array(ruleSchema),
  meta: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
});
const resultSchema = z
  .object({
    ruleId: z.uuid(),
    name: z.string(),
    kind: z.string(),
    columnName: z.string().nullable(),
    severity: z.string(),
    status: z.enum(['passed', 'failed', 'skipped']),
    message: z.string(),
    params: z.record(z.string(), z.unknown()),
  })
  .strict();
const reportSchema = z.object({
  fileId: z.uuid(),
  status: z.string(),
  qualityScore: z.number().nullable(),
  ruleResults: z.array(resultSchema).nullable(),
});

/** 4 rows: `email` is empty in 2 of them (50%), `id` repeats, and one row is repeated whole. */
const CUSTOMERS = ['id,email,amount', '1,a@x.test,10', '2,,20', '2,,20', '3,c@x.test,-5', ''].join('\n');
const CLEAN = ['id,email,amount', '1,a@x.test,10', '2,b@x.test,20', ''].join('\n');

describe('quality rules: CRUD, evaluation on upload, and rebuild (integration)', () => {
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
    for (const listener of open) listener.close();
  });
  afterAll(() => h.stop());

  // ---- helpers ------------------------------------------------------------

  async function company(plan: 'free' | 'basic' | 'premium' = 'basic') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session, companyId: admin.companyId };
  }

  type NewRule = Partial<{
    name: string;
    kind: string;
    columnName: string;
    params: Record<string, unknown>;
    severity: string;
    enabled: boolean;
  }>;
  const postRule = (session: SessionBody, body: NewRule = {}) =>
    h
      .http()
      .post('/quality-rules')
      .set(...h.bearer(session))
      // With no kind given the rule is "emails are at most 5% empty"; naming a kind means naming its params too.
      .send({
        name: 'Emails are filled in',
        columnName: 'email',
        ...(body.kind === undefined ? { kind: 'max_null_percent', params: { max: 5 } } : {}),
        ...body,
      });
  const createRule = async (session: SessionBody, body: NewRule = {}) =>
    ruleSchema.parse((await postRule(session, body).expect(201)).body);
  const listRules = async (session: SessionBody) =>
    rulePageSchema.parse((await h.http().get('/quality-rules').set(...h.bearer(session)).expect(200)).body);

  const upload = async (session: SessionBody, content: string | Buffer = CUSTOMERS, name = 'customers.csv') =>
    z.object({ id: z.uuid() }).parse((await h.upload(session, { content, name }).expect(201)).body).id;
  const uploaded = async (session: SessionBody, content: string | Buffer = CUSTOMERS, name = 'customers.csv') => {
    const id = await upload(session, content, name);
    await h.drainTasks();
    return id;
  };
  const report = async (session: SessionBody, id: string) =>
    reportSchema.parse((await h.http().get(`/files/${id}/report`).set(...h.bearer(session)).expect(200)).body);
  const resultFor = (r: z.infer<typeof reportSchema>, name: string) => r.ruleResults?.find((x) => x.name === name);
  const inbox = (userId: string, type: string) =>
    h.dataSource.getRepository(Notification).find({ where: { userId, type } });
  const audits = (action: string) => h.dataSource.getRepository(AuditLogEntry).find({ where: { action } });

  // ---- the routes ---------------------------------------------------------------

  describe('POST/GET/PATCH/DELETE /quality-rules', () => {
    it('creates a rule, lists it oldest first, and audits it', async () => {
      const { admin, session } = await company();

      const first = await createRule(session, { name: 'first' });
      const second = await createRule(session, {
        name: 'second',
        kind: 'type_is',
        columnName: 'amount',
        params: { type: 'number' },
        severity: 'warning',
        enabled: false,
      });

      expect(first).toMatchObject({ kind: 'max_null_percent', columnName: 'email', params: { max: 5 }, severity: 'error', enabled: true });
      expect(first.createdByUserId).toBe(admin.userId);
      // Defaults are filled in and stored, so the stored rule says what it does.
      expect(second).toMatchObject({ params: { type: 'number', maxInconsistentPercent: 0 }, severity: 'warning', enabled: false });
      expect((await listRules(session)).data.map((rule) => rule.name)).toEqual(['first', 'second']);
      expect((await audits('quality_rule.created')).map((entry) => entry.metadata)).toMatchObject([
        { name: 'first', kind: 'max_null_percent', columnName: 'email' },
        { name: 'second', kind: 'type_is' },
      ]);
    });

    it('accepts every kind', async () => {
      const { session } = await company('premium');
      await createRule(session, { kind: 'required_column', columnName: 'id', params: {} });
      await createRule(session, { kind: 'required_column', columnName: 'id2' }); // no params at all
      await createRule(session, { kind: 'min_value', columnName: 'amount', params: { min: 0 } });
      await createRule(session, { kind: 'max_value', columnName: 'amount', params: { max: 9 } });
      await createRule(session, { kind: 'unique', columnName: 'id', params: {} });
      const whole = await createRule(session, { kind: 'max_duplicate_rows', params: { max: 0 }, columnName: undefined });
      expect(whole.columnName).toBeNull();
      expect((await listRules(session)).meta.total).toBe(6);
    });

    it.each([
      ['an unknown kind', { kind: 'starts_with' }],
      ['a bad parameter', { params: { max: 500 } }],
      ['a missing parameter', { kind: 'min_value', params: {} }],
      ['an unknown parameter', { params: { max: 5, extra: 1 } }],
      ['a column-rule with no column', { columnName: undefined }],
      ['a whole-file rule that names a column', { kind: 'max_duplicate_rows', params: { max: 0 }, columnName: 'email' }],
      ['an unknown severity', { severity: 'fatal' }],
      ['a blank name', { name: '   ' }],
      ['an over-long name', { name: 'x'.repeat(81) }],
      ['a smuggled company id', { companyId: '00000000-0000-4000-8000-000000000000' }],
    ])('rejects %s (400)', async (_name, body) => {
      const { session } = await company();
      await postRule(session, body).expect(400);
      expect(await h.dataSource.getRepository(QualityRule).count()).toBe(0);
    });

    it('names what is wrong with the params', async () => {
      const { session } = await company();
      const response = await postRule(session, { params: { max: 500 } }).expect(400);
      expect(response.body.message).toMatch(/max_null_percent.*max/);
    });

    it('edits name, severity, enabled and params — the kind is fixed', async () => {
      const { session } = await company();
      const rule = await createRule(session);

      const changed = ruleSchema.parse(
        (
          await h
            .http()
            .patch(`/quality-rules/${rule.id}`)
            .set(...h.bearer(session))
            .send({ name: 'Renamed', severity: 'warning', enabled: false, params: { max: 40 }, columnName: 'contact' })
            .expect(200)
        ).body,
      );

      expect(changed).toMatchObject({ name: 'Renamed', severity: 'warning', enabled: false, params: { max: 40 }, columnName: 'contact', kind: 'max_null_percent' });
      const [entry] = await audits('quality_rule.updated');
      expect(entry?.metadata).toEqual({ fields: ['name', 'columnName', 'params', 'severity', 'enabled'] });

      await h.http().patch(`/quality-rules/${rule.id}`).set(...h.bearer(session)).send({ kind: 'unique' }).expect(400);
      await h.http().patch(`/quality-rules/${rule.id}`).set(...h.bearer(session)).send({}).expect(400);
      // The new params are checked against the rule's kind.
      await h.http().patch(`/quality-rules/${rule.id}`).set(...h.bearer(session)).send({ params: { min: 1 } }).expect(400);
    });

    it('deletes a rule and returns it', async () => {
      const { session } = await company();
      const rule = await createRule(session);

      const deleted = await h.http().delete(`/quality-rules/${rule.id}`).set(...h.bearer(session)).expect(200);

      expect(ruleSchema.parse(deleted.body).id).toBe(rule.id);
      expect((await listRules(session)).data).toEqual([]);
      expect((await audits('quality_rule.deleted')).map((entry) => entry.targetId)).toEqual([rule.id]);
      await h.http().delete(`/quality-rules/${rule.id}`).set(...h.bearer(session)).expect(404);
    });

    it('is admin-only for writes, open to employees for reading, and closed to keys for writes', async () => {
      const { session, companyId } = await company();
      const employee = await h.inviteAndAccept(session, companyId);
      const rule = await createRule(session);

      expect((await listRules(employee.session)).data).toHaveLength(1);
      await postRule(employee.session).expect(403);
      await h.http().patch(`/quality-rules/${rule.id}`).set(...h.bearer(employee.session)).send({ name: 'x' }).expect(403);
      await h.http().delete(`/quality-rules/${rule.id}`).set(...h.bearer(employee.session)).expect(403);

      const { key } = await h.createApiKey(session, { scopes: ['files:read', 'files:write'] });
      await h.http().get('/quality-rules').set('Authorization', `Bearer ${key}`).expect(200);
      await h.http().post('/quality-rules').set('Authorization', `Bearer ${key}`).send({ name: 'x', kind: 'unique', columnName: 'a' }).expect(403);
      await h.http().delete(`/quality-rules/${rule.id}`).set('Authorization', `Bearer ${key}`).expect(403);
      const { key: billingOnly } = await h.createApiKey(session, { scopes: ['billing:read'] });
      await h.http().get('/quality-rules').set('Authorization', `Bearer ${billingOnly}`).expect(403);
      await h.http().get('/quality-rules').expect(401);
      expect(await h.dataSource.getRepository(QualityRule).count()).toBe(1);
    });

    it('needs a plan (402), and never shows or touches another company’s rules (404)', async () => {
      const admin = await h.registerAndActivate();
      const noPlan = await h.login(admin.email);
      await h.http().get('/quality-rules').set(...h.bearer(noPlan)).expect(402);

      const mine = await company();
      const theirs = await company();
      const rule = await createRule(theirs.session);
      expect((await listRules(mine.session)).data).toEqual([]);
      await h.http().patch(`/quality-rules/${rule.id}`).set(...h.bearer(mine.session)).send({ name: 'Mine now' }).expect(404);
      await h.http().delete(`/quality-rules/${rule.id}`).set(...h.bearer(mine.session)).expect(404);
      expect((await listRules(theirs.session)).data.map((r) => r.name)).toEqual(['Emails are filled in']);
    });
  });

  // ---- limits ----------------------------------------------------------------------

  describe('the plan’s limit', () => {
    it('Free allows 3 rules: the 4th is a 409 with the numbers, and deleting one makes room', async () => {
      const { session } = await company('free');
      const created = [];
      for (let i = 0; i < 3; i += 1) created.push(await createRule(session, { name: `rule ${i}` }));

      const refused = await postRule(session, { name: 'one too many' }).expect(409);
      expect(refused.body.message).toMatch(/free plan allows 3 quality rules and you have 3/);
      expect(refused.body.message).toMatch(/upgrade/i);

      await h.http().delete(`/quality-rules/${created[0]?.id}`).set(...h.bearer(session)).expect(200);
      await createRule(session, { name: 'fits now' });
    });

    it('a disabled rule still counts', async () => {
      const { session } = await company('free');
      for (let i = 0; i < 3; i += 1) await createRule(session, { name: `rule ${i}`, enabled: false });
      await postRule(session).expect(409);
    });

    it('Premium has no limit on rules, but at most 10 of them may be `unique`', async () => {
      const { session } = await company('premium');
      for (let i = 0; i < 10; i += 1) await createRule(session, { name: `u${i}`, kind: 'unique', columnName: `c${i}`, params: {} });

      const refused = await postRule(session, { kind: 'unique', columnName: 'c10', params: {} }).expect(409);
      expect(refused.body.message).toMatch(/at most 10 `unique` rules/);
      await createRule(session, { name: 'not unique' }); // other kinds are unaffected
    });

    it('is checked under the subscription row lock: a create waits for it, so two admins cannot both take the last slot', async () => {
      const { session, companyId } = await company('free');
      const runner = h.dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query(`SELECT 1 FROM subscription WHERE "companyId" = $1 FOR UPDATE`, [companyId]);
        let finished = false;
        const pending = postRule(session).then((response) => {
          finished = true;
          return response;
        });
        await settle(500);
        expect(finished).toBe(false);

        await runner.commitTransaction();
        expect((await pending).status).toBe(201);
      } finally {
        await runner.release();
      }
    });

    it('a downgrade that leaves more rules than the target plan allows is refused, naming the excess', async () => {
      const { session, admin } = await company('basic');
      const rules = [];
      for (let i = 0; i < 5; i += 1) rules.push(await createRule(session, { name: `rule ${i}` }));

      const refused = await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'free' }).expect(409);
      expect(JSON.stringify(refused.body.message)).toMatch(/Free allows 3 quality rules, but the company has 5 — delete 2 first/);

      for (const rule of rules.slice(0, 2)) await h.http().delete(`/quality-rules/${rule.id}`).set(...h.bearer(session)).expect(200);
      await h.http().patch('/subscriptions/me').set(...h.bearer(await h.login(admin.email))).send({ plan: 'free' }).expect(200);
    });
  });

  // ---- evaluation on upload ---------------------------------------------------------

  describe('a file is checked against the rules when its report is built', () => {
    it('records a result and a score per rule, and a failing error rule notifies the uploader and the admin', async () => {
      const { admin, session, companyId } = await company();
      const employee = await h.inviteAndAccept(session, companyId);
      await createRule(session, { name: 'Emails filled', kind: 'max_null_percent', columnName: 'email', params: { max: 5 } });
      await createRule(session, { name: 'IDs unique', kind: 'unique', columnName: 'id', params: {} });
      await createRule(session, { name: 'Amounts positive', kind: 'min_value', columnName: 'amount', params: { min: 0 }, severity: 'warning' });
      await createRule(session, { name: 'No repeated rows', kind: 'max_duplicate_rows', params: { max: 0 }, columnName: undefined });
      await createRule(session, { name: 'Has a phone', kind: 'required_column', columnName: 'phone' });
      await createRule(session, { name: 'Ages are numbers', kind: 'type_is', columnName: 'age', params: { type: 'integer' } });

      const id = await uploaded(employee.session);
      const r = await report(employee.session, id);

      expect(r.status).toBe('ready');
      expect(r.ruleResults?.map((x) => [x.name, x.status])).toEqual([
        ['Emails filled', 'failed'],
        ['IDs unique', 'failed'],
        ['Amounts positive', 'failed'],
        ['No repeated rows', 'failed'],
        ['Has a phone', 'failed'],
        ['Ages are numbers', 'skipped'], // the file has no `age` column
      ]);
      expect(resultFor(r, 'Emails filled')?.message).toBe('50% of "email" is empty; at most 5% allowed.');
      expect(resultFor(r, 'IDs unique')?.message).toBe('1 repeated value in "id"; every value must be unique.');
      expect(resultFor(r, 'Amounts positive')?.message).toBe('Smallest value in "amount" is -5; at least 0 required.');
      expect(resultFor(r, 'Has a phone')?.message).toBe('Column "phone" is missing.');
      expect(r.qualityScore).toBe(0); // 4 errors and 1 warning, all failed

      const failedNames = ['Emails filled', 'IDs unique', 'No repeated rows', 'Has a phone'];
      for (const userId of [employee.userId, admin.userId]) {
        const [entry] = await inbox(userId, 'rules.failed');
        expect(entry?.payload).toMatchObject({ fileId: id, fileName: 'customers.csv', failedRules: failedNames, qualityScore: 0 });
      }
    });

    it('a clean file passes everything: score 100, and no rules.failed notification', async () => {
      const { admin, session } = await company();
      await createRule(session, { name: 'Emails filled', columnName: 'email' });
      await createRule(session, { name: 'IDs unique', kind: 'unique', columnName: 'id', params: {} });

      const r = await report(session, await uploaded(session, CLEAN));

      expect(r.qualityScore).toBe(100);
      expect(r.ruleResults?.every((x) => x.status === 'passed')).toBe(true);
      expect(await inbox(admin.userId, 'rules.failed')).toEqual([]);
      expect(await inbox(admin.userId, 'report.ready')).toHaveLength(1);
    });

    it('a failing WARNING lowers the score but notifies nobody', async () => {
      const { admin, session } = await company();
      await createRule(session, { name: 'Amounts positive', kind: 'min_value', columnName: 'amount', params: { min: 0 }, severity: 'warning' });
      await createRule(session, { name: 'IDs there', kind: 'required_column', columnName: 'id' });

      const r = await report(session, await uploaded(session));

      expect(r.qualityScore).toBe(67); // the error passes (2 of 2), the warning fails (0 of 1)
      expect(await inbox(admin.userId, 'rules.failed')).toEqual([]);
    });

    it('with no rules there is no score and no results; with only inapplicable rules there is no score either', async () => {
      const { session } = await company();
      const bare = await report(session, await uploaded(session));
      expect(bare).toMatchObject({ status: 'ready', qualityScore: null, ruleResults: null });

      await createRule(session, { name: 'Ages', kind: 'max_null_percent', columnName: 'age', params: { max: 0 } });
      const inapplicable = await report(session, await uploaded(session, CLEAN, 'clean.csv'));
      expect(inapplicable.qualityScore).toBeNull();
      expect(inapplicable.ruleResults?.map((x) => x.status)).toEqual(['skipped']);
    });

    it('a disabled rule is not checked', async () => {
      const { session } = await company();
      await createRule(session, { name: 'Off', enabled: false });
      await createRule(session, { name: 'On', columnName: 'id' });

      const r = await report(session, await uploaded(session));

      expect(r.ruleResults?.map((x) => x.name)).toEqual(['On']);
    });

    it('matches the column name case-insensitively', async () => {
      const { session } = await company();
      await createRule(session, { name: 'Upper', columnName: 'EMAIL', params: { max: 100 } });

      expect(resultFor(await report(session, await uploaded(session)), 'Upper')?.status).toBe('passed');
    });

    it('never applies another company’s rules', async () => {
      const mine = await company();
      const theirs = await company();
      await createRule(theirs.session, { name: 'Theirs' });

      const r = await report(mine.session, await uploaded(mine.session));

      expect(r.ruleResults).toBeNull();
      expect(r.qualityScore).toBeNull();
    });

    it('a legacy .xls (unsupported) is not scored', async () => {
      const { session } = await company();
      await createRule(session);
      const id = z.object({ id: z.uuid() }).parse(
        (await h.upload(session, { content: xlsBytes(), name: 'old.xls', contentType: 'application/vnd.ms-excel' }).expect(201)).body,
      ).id;
      await h.drainTasks();

      expect(await report(session, id)).toMatchObject({ status: 'unsupported', qualityScore: null, ruleResults: null });
    });

    it('only the names of the failed rules reach the AI model — never a value or a number', async () => {
      const { session } = await company();
      await createRule(session, { name: 'Emails filled', columnName: 'email' });
      await createRule(session, { name: 'Amounts positive', kind: 'min_value', columnName: 'amount', params: { min: 0 }, severity: 'warning' });
      await createRule(session, { name: 'Ids', kind: 'required_column', columnName: 'id' });
      h.ai.calls.length = 0;

      await uploaded(session);

      expect(h.ai.calls).toHaveLength(1);
      expect(h.ai.calls[0]?.failedRules).toEqual([
        { name: 'Emails filled', severity: 'error' },
        { name: 'Amounts positive', severity: 'warning' },
      ]);
      expect(JSON.stringify(h.ai.calls[0]?.failedRules)).not.toMatch(/-5|50%|a@x/);
    });

    it('reports the score on the realtime file.status event', async () => {
      const { session } = await company();
      await createRule(session, { name: 'Emails filled', columnName: 'email' });
      const listener = await connect(url, session.accessToken);
      open.push(listener);

      const id = await upload(session);
      await h.drainTasks();
      await listener.waitFor('file.status', 3);

      const events = listener.of('file.status').map((event) => z.object({ fileId: z.string(), status: z.string(), qualityScore: z.number().nullable() }).parse(event));
      expect(events.filter((event) => event.fileId === id).map((event) => [event.status, event.qualityScore])).toEqual([
        ['queued', null],
        ['profiling', null],
        ['ready', 0],
      ]);
    });
  });

  // ---- history: rules change, reports do not ----------------------------------------------

  describe('editing or deleting a rule does not rewrite an existing report', () => {
    it('keeps the snapshot until the report is rebuilt, then applies the rule as it is now', async () => {
      const { session } = await company();
      const rule = await createRule(session, { name: 'Emails filled', columnName: 'email', params: { max: 5 } });
      const id = await uploaded(session);
      expect(resultFor(await report(session, id), 'Emails filled')).toMatchObject({ status: 'failed', params: { max: 5 } });

      await h.http().patch(`/quality-rules/${rule.id}`).set(...h.bearer(session)).send({ params: { max: 90 }, name: 'Renamed' }).expect(200);
      const stale = await report(session, id);
      expect(resultFor(stale, 'Emails filled')).toMatchObject({ status: 'failed', params: { max: 5 } });
      expect(resultFor(stale, 'Renamed')).toBeUndefined();

      const rebuilding = await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(session)).expect(200);
      expect(rebuilding.body).toMatchObject({ status: 'queued', qualityScore: null, ruleResults: null });
      await h.drainTasks();

      const fresh = await report(session, id);
      expect(fresh.status).toBe('ready');
      expect(resultFor(fresh, 'Renamed')).toMatchObject({ status: 'passed', params: { max: 90 } });
      expect(fresh.qualityScore).toBe(100);
    });

    it('keeps the result of a rule that has since been deleted', async () => {
      const { session } = await company();
      const rule = await createRule(session, { name: 'Emails filled' });
      const id = await uploaded(session);

      await h.http().delete(`/quality-rules/${rule.id}`).set(...h.bearer(session)).expect(200);

      expect(resultFor(await report(session, id), 'Emails filled')?.status).toBe('failed');
      await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(session)).expect(200);
      await h.drainTasks();
      expect((await report(session, id)).ruleResults).toBeNull();
    });
  });

  describe('POST /files/:id/report/rebuild', () => {
    it('is for the uploader and admins: another employee who can see the file gets 403, someone who cannot gets 404', async () => {
      const { session, companyId } = await company();
      const uploader = await h.inviteAndAccept(session, companyId);
      const colleague = await h.inviteAndAccept(session, companyId);
      const id = await uploaded(uploader.session);

      await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(colleague.session)).expect(403);
      await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(uploader.session)).expect(200);
      await h.drainTasks();
      await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(session)).expect(200);
      await h.drainTasks();

      const restricted = await uploaded(uploader.session);
      await h.http().patch(`/files/${restricted}`).set(...h.bearer(uploader.session)).send({ visibility: 'restricted' }).expect(200);
      await h.http().post(`/files/${restricted}/report/rebuild`).set(...h.bearer(colleague.session)).expect(404);
      await h.http().post(`/files/00000000-0000-4000-8000-000000000000/report/rebuild`).set(...h.bearer(session)).expect(404);
    });

    it('is refused (409) while a build is already queued, and queues exactly one task', async () => {
      const { session } = await company();
      const id = await uploaded(session);

      await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(session)).expect(200);
      const again = await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(session)).expect(409);
      expect(again.body.message).toMatch(/already being built/);

      const tasks = await h.dataSource.query(
        `SELECT count(*)::int AS n FROM background_task WHERE type = 'build_data_quality_report' AND status = 'pending'`,
      );
      expect(tasks[0].n).toBe(1);
    });

    it('is also refused on a report that was never built yet (still queued from the upload)', async () => {
      const { session } = await company();
      const id = await upload(session);
      await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(session)).expect(409);
    });

    it('audits the request, announces the queued status, and works for a failed report', async () => {
      const { session } = await company();
      const listener = await connect(url, session.accessToken);
      open.push(listener);
      const id = await uploaded(session, 'a,b\n' + 'x,y\n'.repeat(20_000) + '1,"never closed\n2,3\n', 'broken.csv');
      expect((await report(session, id)).status).toBe('failed');
      listener.events.length = 0;

      await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(session)).expect(200);

      expect((await audits('report.rebuild_requested')).map((entry) => entry.targetId)).toEqual([id]);
      await listener.waitFor('file.status');
      expect(listener.of('file.status')[0]).toMatchObject({ fileId: id, status: 'queued' });
      await h.drainTasks();
      expect((await report(session, id)).status).toBe('failed'); // the same bytes, the same outcome
    });

    it('a deleted file cannot be rebuilt (404)', async () => {
      const { session } = await company();
      const id = await uploaded(session);
      await h.http().delete(`/files/${id}`).set(...h.bearer(session)).expect(200);
      await h.http().post(`/files/${id}/report/rebuild`).set(...h.bearer(session)).expect(404);
    });

    it('needs files:write for an API key, and a session for nothing else', async () => {
      const { session } = await company();
      const id = await uploaded(session);
      const { key: readOnly } = await h.createApiKey(session, { scopes: ['files:read'] });
      const { key: writer } = await h.createApiKey(session, { scopes: ['files:write'] });

      await h.http().post(`/files/${id}/report/rebuild`).set('Authorization', `Bearer ${readOnly}`).expect(403);
      await h.http().post(`/files/${id}/report/rebuild`).set('Authorization', `Bearer ${writer}`).expect(200);
    });
  });
});
