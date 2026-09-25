import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppHarness, DEFAULT_PASSWORD, type SessionBody } from '#test/support/app-harness.js';
import { csvBytes, docBytes, docxBytes, exeBytes, xlsBytes, xlsxBytes } from '#test/support/spreadsheet-fixtures.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { IdempotencyRecord } from '#/core/idempotency/idempotency-record.entity.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { SubscriptionChange } from '#/subscriptions/subscription-change.entity.js';
import { FileAccessGrant } from './file-access-grant.entity.js';
import { FileAsset } from './file-asset.entity.js';
import { CSV_MIME, XLSX_MIME, XLS_MIME } from './spreadsheet-types.js';

const fileSchema = z
  .object({
    id: z.uuid(),
    originalName: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number(),
    visibility: z.enum(['company', 'restricted']),
    uploaderId: z.uuid(),
    datasetId: z.uuid(),
    version: z.number().int(),
    isLatest: z.boolean(),
    grantedUserIds: z.array(z.uuid()).nullable(),
    createdAt: z.string(),
  })
  .strict();
const pageSchema = z.object({
  data: z.array(fileSchema),
  meta: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
});

describe('files (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  // ---- helpers ------------------------------------------------------------

  interface Member {
    userId: string;
    session: SessionBody;
    email: string;
  }

  /** A company on `plan` with its admin signed in. */
  async function company(plan: 'free' | 'basic' | 'premium' = 'basic') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session, companyId: admin.companyId };
  }

  /** Admin plus three employees (A, B, C) on Basic. */
  async function team() {
    const base = await company('basic');
    const member = async (): Promise<Member> => {
      const e = await h.inviteAndAccept(base.session, base.companyId);
      return { userId: e.userId, session: e.session, email: e.email };
    };
    return { ...base, a: await member(), b: await member(), c: await member() };
  }

  async function uploaded(session: SessionBody, options: Parameters<AppHarness['upload']>[1] = {}) {
    const response = await h.upload(session, options).expect(201);
    return fileSchema.parse(response.body);
  }

  async function storedObjects(): Promise<string[]> {
    const entries = await readdir(h.storageDir, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
  }

  const usageCount = (companyId?: string) =>
    h.dataSource.getRepository(UsageEvent).count(companyId ? { where: { companyId } } : {});
  const fileCount = () => h.dataSource.getRepository(FileAsset).count();
  const get = (session: SessionBody, id: string) =>
    h.http().get(`/files/${id}`).set(...h.bearer(session));

  // ---- gatekeeping --------------------------------------------------------

  describe('access', () => {
    it('needs a signed-in user', async () => {
      await h.http().get('/files').expect(401);
      await h.http().post('/files').expect(401);
    });

    it('answers 402 on every route until a plan is chosen', async () => {
      const admin = await h.registerAndActivate();
      const session = await h.login(admin.email);

      await h.http().get('/files').set(...h.bearer(session)).expect(402);
      await h.upload(session).expect(402);
      expect(await storedObjects()).toEqual([]);
    });
  });

  // ---- what may be uploaded ----------------------------------------------

  describe('POST /files — what is accepted', () => {
    it('stores a CSV and describes it — with no storage key in sight', async () => {
      const { session, admin } = await company();

      const response = await h.upload(session, { name: 'sales.csv', content: 'a,b\n1,2\n' }).expect(201);
      const file = fileSchema.parse(response.body);

      expect(file).toMatchObject({
        originalName: 'sales.csv',
        mimeType: CSV_MIME,
        sizeBytes: 8,
        visibility: 'company',
        uploaderId: admin.userId,
        grantedUserIds: [],
      });
      expect(JSON.stringify(response.body)).not.toContain('storageKey');
      const [object] = await storedObjects();
      expect(object).toBeDefined();
      expect((await readFile(object ?? '')).toString()).toBe('a,b\n1,2\n');
    });

    it('records exactly one usage event, one queued report task and one audit entry', async () => {
      const { session, companyId } = await company();
      const file = await uploaded(session);

      const events = await h.dataSource.getRepository(UsageEvent).find({ where: { companyId } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ fileId: file.id, periodKey: '2026-03-01' });

      const tasks = await h.dataSource.getRepository(BackgroundTask).find({ where: { type: 'build_data_quality_report' } });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.payload).toEqual({ fileId: file.id, companyId });

      const audit = await h.dataSource.getRepository(AuditLogEntry).find({ where: { companyId, action: 'file.uploaded' } });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ targetType: 'file', targetId: file.id });

      await h.drainTasks();
      expect((await h.dataSource.getRepository(BackgroundTask).findOneByOrFail({ type: 'build_data_quality_report' })).status).toBe('succeeded');
    });

    it.each([
      ['an XLSX', xlsxBytes, XLSX_MIME],
      ['an XLS', xlsBytes, XLS_MIME],
    ])('accepts %s by its bytes, whatever Content-Type the client sent', async (_name, bytes, mime) => {
      const { session } = await company();

      const file = await uploaded(session, { content: bytes(), name: 'book.csv', contentType: 'text/csv' });

      expect(file.mimeType).toBe(mime);
    });

    it('records the type the BYTES have when the client lies the other way', async () => {
      const { session } = await company();
      const file = await uploaded(session, { content: csvBytes(), name: 'x.xlsx', contentType: XLSX_MIME });

      expect(file.mimeType).toBe(CSV_MIME);
    });

    it('keeps only the base name and preserves non-ASCII names', async () => {
      const { session } = await company();

      expect((await uploaded(session, { name: '..\\..\\etc\\evil.csv' })).originalName).toBe('evil.csv');
      expect((await uploaded(session, { name: 'ანგარიში 2026.csv' })).originalName).toBe('ანგარიში 2026.csv');
    });
  });

  describe('POST /files — what is refused, and what that costs (nothing)', () => {
    async function expectNothingWasKept(companyId: string) {
      expect(await fileCount()).toBe(0);
      expect(await usageCount(companyId)).toBe(0);
      expect(await storedObjects()).toEqual([]);
      expect(await h.dataSource.getRepository(BackgroundTask).count({ where: { type: 'build_data_quality_report' } })).toBe(0);
    }

    it.each([
      ['a Windows executable renamed .csv and sent as text/csv', exeBytes, 'report.csv', 'text/csv'],
      ['a Word .docx renamed .xlsx', docxBytes, 'report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['a Word .doc renamed .xls', docBytes, 'report.xls', 'application/vnd.ms-excel'],
      ['an empty file', () => Buffer.alloc(0), 'empty.csv', 'text/csv'],
      ['binary garbage', () => Buffer.from(Array.from({ length: 300 }, (_, i) => (i * 31 + 7) % 256)), 'x.csv', 'text/csv'],
    ])('rejects %s with 400 and consumes no quota', async (_name, bytes, filename, contentType) => {
      const { session, companyId } = await company();

      const response = await h.upload(session, { content: bytes(), name: filename, contentType }).expect(400);

      expect(response.body.message).toMatch(/CSV, XLS and XLSX/);
      await expectNothingWasKept(companyId);
    });

    it('rejects a request with no file', async () => {
      const { session, companyId } = await company();
      await h.http().post('/files').set(...h.bearer(session)).field('visibility', 'company').expect(400);
      await expectNothingWasKept(companyId);
    });

    it('rejects a file over 25 MB with 413, before anything is stored', async () => {
      const { session, companyId } = await company();
      const big = Buffer.alloc(26 * 1024 * 1024, 'a');

      await h.upload(session, { content: big }).expect(413);
      await expectNothingWasKept(companyId);
    });

    it('accepts a file just under the limit', async () => {
      const { session } = await company();
      const nearly = Buffer.from('a,b\n'.repeat(Math.floor((25 * 1024 * 1024 - 8) / 4)));

      await h.upload(session, { content: nearly }).expect(201);
    });

    it('rejects an unknown field and a bad visibility', async () => {
      const { session } = await company();
      await h.upload(session).field('role', 'admin').expect(400);
      await h.upload(session, { visibility: 'public' as 'company' }).expect(400);
    });

    it('a storage failure consumes no quota and leaves no row', async () => {
      const { session, companyId } = await company();
      vi.spyOn(h.storage, 'put').mockRejectedValueOnce(new Error('S3 is down'));

      await h.upload(session).expect(500);

      await expectNothingWasKept(companyId);
    });

    it('a failure AFTER the object is stored removes the object again', async () => {
      const { session, companyId } = await company();
      vi.spyOn(h.app.get(TaskQueue), 'enqueue').mockRejectedValueOnce(new Error('queue down'));

      await h.upload(session).expect(500);

      // The whole transaction rolled back, and the orphaned object was cleaned up.
      await expectNothingWasKept(companyId);
    });
  });

  // ---- who can see what (the visibility predicate) ------------------------

  describe('visibility', () => {
    it('A restricts a file to B: C gets 404 everywhere, B and the admin see it', async () => {
      const t = await team();
      const file = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId] });

      // C cannot see it — and the answer is 404, never 403.
      await get(t.c.session, file.id).expect(404);
      await h.http().get(`/files/${file.id}/download`).set(...h.bearer(t.c.session)).expect(404);
      await h.http().patch(`/files/${file.id}`).set(...h.bearer(t.c.session)).send({ visibility: 'company' }).expect(404);
      await h.http().delete(`/files/${file.id}`).set(...h.bearer(t.c.session)).expect(404);
      const cList = pageSchema.parse((await h.http().get('/files').set(...h.bearer(t.c.session)).expect(200)).body);
      expect(cList.data).toEqual([]);

      // B (granted), A (uploader) and the admin can.
      for (const viewer of [t.b.session, t.a.session, t.session]) {
        await get(viewer, file.id).expect(200);
        const list = pageSchema.parse((await h.http().get('/files').set(...h.bearer(viewer)).expect(200)).body);
        expect(list.data.map((row) => row.id)).toEqual([file.id]);
      }
      await h.http().get(`/files/${file.id}/download`).set(...h.bearer(t.b.session)).expect(200);
    });

    it('a restricted file with no grantees is visible to the uploader and admin only', async () => {
      const t = await team();
      const file = await uploaded(t.a.session, { visibility: 'restricted' });

      await get(t.a.session, file.id).expect(200);
      await get(t.session, file.id).expect(200);
      await get(t.b.session, file.id).expect(404);
    });

    it('a company-wide file is visible to every member', async () => {
      const t = await team();
      const file = await uploaded(t.a.session);

      for (const viewer of [t.a.session, t.b.session, t.c.session, t.session]) {
        await get(viewer, file.id).expect(200);
      }
    });

    it('shows who a file is shared with only to the uploader and admins', async () => {
      const t = await team();
      const file = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId] });

      expect(fileSchema.parse((await get(t.a.session, file.id)).body).grantedUserIds).toEqual([t.b.userId]);
      expect(fileSchema.parse((await get(t.session, file.id)).body).grantedUserIds).toEqual([t.b.userId]);
      // B can see the file but learns nothing about who ELSE can.
      expect(fileSchema.parse((await get(t.b.session, file.id)).body).grantedUserIds).toBeNull();
      // Lists never carry grantees.
      const list = pageSchema.parse((await h.http().get('/files').set(...h.bearer(t.a.session))).body);
      expect(list.data[0]?.grantedUserIds).toBeNull();
    });

    it('never crosses companies', async () => {
      const t = await team();
      const other = await company('basic');
      const file = await uploaded(t.a.session);
      await uploaded(other.session);

      await get(other.session, file.id).expect(404);
      const list = pageSchema.parse((await h.http().get('/files').set(...h.bearer(other.session))).body);
      expect(list.data).toHaveLength(1);
      expect(list.data[0]?.id).not.toBe(file.id);
    });

    it('a malformed id is 400; an unknown id is 404', async () => {
      const { session } = await company();
      await get(session, 'not-a-uuid').expect(400);
      await get(session, randomUUID()).expect(404);
    });
  });

  describe('grantees', () => {
    it('must be active members of THIS company — one message for unknown, foreign and inactive', async () => {
      const t = await team();
      const foreign = await h.registerAndActivate();
      const invited = await h.inviteEmployee(t.session);
      const removed = await h.inviteAndAccept(t.session, t.companyId);
      await h.http().delete(`/employees/${removed.userId}`).set(...h.bearer(t.session)).expect(200);

      for (const bad of [randomUUID(), foreign.userId, invited.userId, removed.userId]) {
        const response = await h
          .upload(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId, bad] })
          .expect(400);
        expect(response.body.message).toContain(bad);
      }
      expect(await fileCount()).toBe(0);
      expect(await storedObjects()).toEqual([]);
    });

    it('cannot be attached to a company-wide file', async () => {
      const t = await team();
      await h.upload(t.a.session, { visibility: 'company', grantedUserIds: [t.b.userId] }).expect(400);
    });

    it('drops the uploader and duplicates rather than storing them', async () => {
      const t = await team();
      const file = await uploaded(t.a.session, {
        visibility: 'restricted',
        grantedUserIds: [t.a.userId, t.b.userId, t.b.userId],
      }).catch(() => null);
      // A duplicate id in the request is refused outright (ArrayUnique) …
      expect(file).toBeNull();

      // … while the uploader naming themself is silently redundant.
      const ok = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.a.userId, t.b.userId] });
      expect(await h.dataSource.getRepository(FileAccessGrant).find({ where: { fileId: ok.id } })).toHaveLength(1);
    });

    it('accepts a single field, repeated fields, and a JSON array', async () => {
      const t = await team();

      const single = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId] });
      const repeated = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId, t.c.userId] });
      const json = fileSchema.parse(
        (
          await h
            .upload(t.a.session, { visibility: 'restricted' })
            .field('grantedUserIds', JSON.stringify([t.b.userId, t.c.userId]))
            .expect(201)
        ).body,
      );

      expect(single.grantedUserIds).toEqual([t.b.userId]);
      expect(repeated.grantedUserIds?.sort()).toEqual([t.b.userId, t.c.userId].sort());
      expect(json.grantedUserIds?.sort()).toEqual([t.b.userId, t.c.userId].sort());
    });
  });

  // ---- changing access ----------------------------------------------------

  describe('PATCH /files/:id', () => {
    const patch = (session: SessionBody, id: string, body: object) =>
      h.http().patch(`/files/${id}`).set(...h.bearer(session)).send(body);

    it('lets the uploader grant and revoke; the change takes effect at once', async () => {
      const t = await team();
      const file = await uploaded(t.a.session, { visibility: 'restricted' });
      await get(t.b.session, file.id).expect(404);

      await patch(t.a.session, file.id, { grantedUserIds: [t.b.userId] }).expect(200);
      await get(t.b.session, file.id).expect(200);

      await patch(t.a.session, file.id, { grantedUserIds: [t.c.userId] }).expect(200);
      await get(t.b.session, file.id).expect(404);
      await get(t.c.session, file.id).expect(200);
    });

    it('lets an admin change any file', async () => {
      const t = await team();
      const file = await uploaded(t.a.session);

      await patch(t.session, file.id, { visibility: 'restricted', grantedUserIds: [t.b.userId] }).expect(200);

      await get(t.c.session, file.id).expect(404);
      await get(t.b.session, file.id).expect(200);
    });

    it('is 403 for someone who can see the file but does not own it', async () => {
      const t = await team();
      const file = await uploaded(t.a.session);

      await patch(t.b.session, file.id, { visibility: 'restricted' }).expect(403);
      expect(fileSchema.parse((await get(t.a.session, file.id)).body).visibility).toBe('company');
    });

    it('switching to company clears every grant', async () => {
      const t = await team();
      const file = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId] });

      const changed = fileSchema.parse((await patch(t.a.session, file.id, { visibility: 'company' }).expect(200)).body);

      expect(changed).toMatchObject({ visibility: 'company', grantedUserIds: [] });
      expect(await h.dataSource.getRepository(FileAccessGrant).count()).toBe(0);
    });

    it('rejects contradictions and empty bodies', async () => {
      const t = await team();
      const open = await uploaded(t.a.session);
      const closed = await uploaded(t.a.session, { visibility: 'restricted' });

      await patch(t.a.session, open.id, {}).expect(400);
      await patch(t.a.session, open.id, { grantedUserIds: [t.b.userId] }).expect(400);
      await patch(t.a.session, open.id, { visibility: 'company', grantedUserIds: [t.b.userId] }).expect(400);
      await patch(t.a.session, closed.id, { grantedUserIds: [randomUUID()] }).expect(400);
      await patch(t.a.session, closed.id, { visibility: 'nope' }).expect(400);
      await patch(t.a.session, closed.id, { name: 'renamed' }).expect(400);
    });

    it('audits the change with counts, not identities', async () => {
      const t = await team();
      const file = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId] });
      await patch(t.a.session, file.id, { grantedUserIds: [t.c.userId] }).expect(200);

      const entry = await h.dataSource
        .getRepository(AuditLogEntry)
        .findOneByOrFail({ companyId: t.companyId, action: 'file.access_changed' });
      expect(entry.metadata).toMatchObject({ grantsAdded: 1, grantsRemoved: 1 });
    });
  });

  // ---- deleting ----------------------------------------------------------

  describe('DELETE /files/:id', () => {
    const remove = (session: SessionBody, id: string) =>
      h.http().delete(`/files/${id}`).set(...h.bearer(session));

    it('soft-deletes: the object goes, the row and its history stay', async () => {
      const t = await team();
      const file = await uploaded(t.a.session);
      expect(await storedObjects()).toHaveLength(1);

      await remove(t.a.session, file.id).expect(200);

      expect(await storedObjects()).toEqual([]);
      const row = await h.dataSource.getRepository(FileAsset).findOneByOrFail({ id: file.id });
      expect(row.deletedAt).not.toBeNull();
      await get(t.a.session, file.id).expect(404);
      await get(t.session, file.id).expect(404);
      const list = pageSchema.parse((await h.http().get('/files').set(...h.bearer(t.session))).body);
      expect(list.data).toEqual([]);
      expect(await h.dataSource.getRepository(AuditLogEntry).count({ where: { action: 'file.deleted' } })).toBe(1);
    });

    it('does not refund quota: the upload counted when it happened', async () => {
      const { session, companyId } = await company('free');
      const file = await uploaded(session);

      await remove(session, file.id).expect(200);

      expect(await usageCount(companyId)).toBe(1);
      const subscription = await h.http().get('/subscriptions/me').set(...h.bearer(session)).expect(200);
      expect(subscription.body.usage.files).toBe(1);
    });

    it('cannot be repeated', async () => {
      const t = await team();
      const file = await uploaded(t.a.session);
      await remove(t.a.session, file.id).expect(200);
      await remove(t.a.session, file.id).expect(404);
    });

    it('is 403 for a colleague who can see the file, allowed for the admin', async () => {
      const t = await team();
      const file = await uploaded(t.a.session);

      await remove(t.b.session, file.id).expect(403);
      expect(await storedObjects()).toHaveLength(1);
      await remove(t.session, file.id).expect(200);
    });

    it('still succeeds when the object cannot be removed (it is already invisible)', async () => {
      const { session } = await company();
      const file = await uploaded(session);
      vi.spyOn(h.storage, 'delete').mockRejectedValueOnce(new Error('S3 is down'));

      await remove(session, file.id).expect(200);
      await get(session, file.id).expect(404);
    });
  });

  // ---- downloading -------------------------------------------------------

  describe('GET /files/:id/download', () => {
    it('returns a short-lived signed link that serves the bytes as an attachment', async () => {
      const { session } = await company();
      const file = await uploaded(session, { name: 'Q1 ანგარიში.csv', content: 'a,b\n1,2\n' });

      const link = z
        .object({ url: z.string(), expiresAt: z.string() })
        .parse((await h.http().get(`/files/${file.id}/download`).set(...h.bearer(session)).expect(200)).body);
      expect(link.expiresAt).toBe('2026-03-01T12:05:00.000Z');

      const target = new URL(link.url);
      // No Authorization header: the signed link is the credential.
      const download = await h.http().get(`${target.pathname}${target.search}`).expect(200);
      expect(download.headers['content-disposition']).toContain('attachment');
      expect(download.headers['content-disposition']).toContain('filename*=UTF-8');
      expect(Buffer.from(download.body).toString()).toBe('a,b\n1,2\n');
    });

    it('stops working after five minutes', async () => {
      const { session } = await company();
      const file = await uploaded(session);
      const link = z.object({ url: z.string() }).parse(
        (await h.http().get(`/files/${file.id}/download`).set(...h.bearer(session))).body,
      );
      const target = new URL(link.url);

      h.clock.advance(4 * 60_000);
      await h.http().get(`${target.pathname}${target.search}`).expect(200);
      h.clock.advance(2 * 60_000);
      await h.http().get(`${target.pathname}${target.search}`).expect(404);
    });

    it('cannot be redirected at another object', async () => {
      const { session } = await company();
      const file = await uploaded(session);
      const link = z.object({ url: z.string() }).parse(
        (await h.http().get(`/files/${file.id}/download`).set(...h.bearer(session))).body,
      );
      const target = new URL(link.url);
      target.searchParams.set('key', 'companies/someone-else/files/x');

      await h.http().get(`${target.pathname}${target.search}`).expect(404);
      await h.http().get('/storage/local?key=../../etc/passwd&exp=9999999999&name=x&sig=y').expect(404);
    });
  });

  // ---- quota -------------------------------------------------------------

  describe('quota', () => {
    it('Free: the 10th file is accepted and the 11th is 402, naming plan, count, cap and reset date', async () => {
      const { session, companyId } = await company('free');
      await h.seedUsage(companyId, 9, '2026-03-01');

      await uploaded(session);
      const refused = await h.upload(session).expect(402);

      expect(refused.body.message).toContain('free');
      expect(refused.body.message).toContain('10');
      expect(refused.body.message).toContain('2026-04-01');
      expect(await usageCount(companyId)).toBe(10);
      // The refused upload never started: only the accepted file is in storage.
      expect(await storedObjects()).toHaveLength(1);
    });

    it('Basic blocks at 100', async () => {
      const { session, companyId } = await company('basic');
      await h.seedUsage(companyId, 100, '2026-03-01');

      const refused = await h.upload(session).expect(402);
      expect(refused.body.message).toContain('basic');
      expect(await storedObjects()).toEqual([]);
    });

    it('Premium: past 1000 the upload is accepted, flagged with a warning header, and still counted', async () => {
      const { session, companyId } = await company('premium');
      await h.seedUsage(companyId, 999, '2026-03-01');

      const last = await h.upload(session).expect(201);
      expect(last.headers['x-gridline-quota-warning']).toBeUndefined();
      const over = await h.upload(session).expect(201);

      expect(over.headers['x-gridline-quota-warning']).toMatch(/file 1001 of 1000.*\$0\.50/);
      expect(await usageCount(companyId)).toBe(1001);
    });

    it('a new billing period starts a fresh quota', async () => {
      const { admin, companyId } = await company('free');
      await h.seedUsage(companyId, 10, '2026-03-01');
      h.clock.advance(32 * 86_400_000); // 2026-04-02: March's period has ended
      const session = await h.login(admin.email);

      const file = await uploaded(session);

      const events = await h.dataSource.getRepository(UsageEvent).find({ where: { fileId: file.id } });
      expect(events[0]?.periodKey).toBe('2026-04-01');
    });

    it('two uploads racing for the last slot: exactly one wins, the other leaves nothing behind', async () => {
      const { session, companyId } = await company('free');
      await h.seedUsage(companyId, 9, '2026-03-01');

      const results = await Promise.all([h.upload(session), h.upload(session)]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 402]);
      expect(await usageCount(companyId)).toBe(10);
      expect(await storedObjects()).toHaveLength(1);
    });

    it('serialises on the subscription lock: with the row locked elsewhere, an upload waits', async () => {
      const { session, companyId } = await company('free');
      const holder = h.dataSource.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      try {
        await holder.query('SELECT id FROM subscription WHERE "companyId" = $1 FOR UPDATE', [companyId]);

        let settled = false;
        const pending = h.upload(session).then((response) => {
          settled = true;
          return response;
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Had it read the count without the lock it would sail through in milliseconds.
        expect(settled).toBe(false);

        await holder.rollbackTransaction();
        expect((await pending).status).toBe(201);
      } finally {
        if (holder.isTransactionActive) await holder.rollbackTransaction();
        await holder.release();
      }
    });
  });

  // ---- idempotency -------------------------------------------------------

  describe('Idempotency-Key', () => {
    it('a retry with the same key and file replays the first answer and counts once', async () => {
      const { session, companyId } = await company('free');
      const key = randomUUID();
      const content = csvBytes();

      const first = await h.upload(session, { idempotencyKey: key, content }).expect(201);
      const retry = await h.upload(session, { idempotencyKey: key, content }).expect(201);

      expect(retry.body).toEqual(first.body);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(first.headers['idempotent-replayed']).toBeUndefined();
      expect(await fileCount()).toBe(1);
      expect(await usageCount(companyId)).toBe(1);
      expect(await storedObjects()).toHaveLength(1);
    });

    it('replays even after the quota has since run out', async () => {
      const { session, companyId } = await company('free');
      const key = randomUUID();
      const content = csvBytes();
      await h.upload(session, { idempotencyKey: key, content }).expect(201);
      await h.seedUsage(companyId, 9, '2026-03-01');
      await h.upload(session).expect(402);

      await h.upload(session, { idempotencyKey: key, content }).expect(201);
    });

    it('the same key with a different file is 422 and stores nothing', async () => {
      const { session } = await company();
      const key = randomUUID();
      await h.upload(session, { idempotencyKey: key, content: 'a,b\n1,2\n' }).expect(201);

      const clash = await h.upload(session, { idempotencyKey: key, content: 'a,b\n9,9\n' }).expect(422);

      expect(clash.body.message).toMatch(/different request/);
      expect(await fileCount()).toBe(1);
    });

    it('the same key with different visibility is a different request', async () => {
      const { session } = await company();
      const key = randomUUID();
      const content = csvBytes();
      await h.upload(session, { idempotencyKey: key, content }).expect(201);

      await h.upload(session, { idempotencyKey: key, content, visibility: 'restricted' }).expect(422);
    });

    it('does not remember a request that failed, so the corrected retry runs', async () => {
      const { session } = await company();
      const key = randomUUID();

      await h.upload(session, { idempotencyKey: key, content: exeBytes(), name: 'x.csv' }).expect(400);
      expect(await h.dataSource.getRepository(IdempotencyRecord).count()).toBe(0);

      await h.upload(session, { idempotencyKey: key }).expect(201);
    });

    it('replays the quota warning header too', async () => {
      const { session, companyId } = await company('premium');
      await h.seedUsage(companyId, 1000, '2026-03-01');
      const key = randomUUID();
      const content = csvBytes();

      await h.upload(session, { idempotencyKey: key, content }).expect(201);
      const retry = await h.upload(session, { idempotencyKey: key, content }).expect(201);

      expect(retry.headers['x-gridline-quota-warning']).toMatch(/\$0\.50/);
      expect(await usageCount(companyId)).toBe(1001);
    });

    it('without a key nothing is deduplicated', async () => {
      const { session, companyId } = await company();
      const content = csvBytes();

      await h.upload(session, { content }).expect(201);
      await h.upload(session, { content }).expect(201);

      expect(await usageCount(companyId)).toBe(2);
    });

    it('rejects a key that is not a UUID', async () => {
      const { session } = await company();
      await h.upload(session, { idempotencyKey: 'not-a-uuid' }).expect(400);
    });

    it('keys are per company: another company may use the same key', async () => {
      const one = await company();
      const two = await company();
      const key = randomUUID();

      await h.upload(one.session, { idempotencyKey: key }).expect(201);
      await h.upload(two.session, { idempotencyKey: key }).expect(201);
    });

    it('a second request with the same key while the first is still running is 409', async () => {
      const { session, companyId } = await company();
      const key = randomUUID();
      const content = csvBytes();
      const holder = h.dataSource.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      try {
        // Stall the first upload inside its transaction.
        await holder.query('SELECT id FROM subscription WHERE "companyId" = $1 FOR UPDATE', [companyId]);
        const first = h.upload(session, { idempotencyKey: key, content }).then((r) => r);
        await new Promise((resolve) => setTimeout(resolve, 500));

        const second = await h.upload(session, { idempotencyKey: key, content });
        expect(second.status).toBe(409);

        await holder.rollbackTransaction();
        expect((await first).status).toBe(201);
      } finally {
        if (holder.isTransactionActive) await holder.rollbackTransaction();
        await holder.release();
      }
    });

    it('reclaims a claim abandoned by a crashed request', async () => {
      const { session, companyId } = await company();
      const key = randomUUID();
      const content = csvBytes();
      // A claim that has been `in_progress` far longer than any request runs is a
      // crashed one. (createdAt is set explicitly: the DB stamps real time, not the fake clock.)
      await h.dataSource.getRepository(IdempotencyRecord).insert({
        companyId,
        key,
        route: 'POST /files',
        requestHash: 'whatever',
        status: 'in_progress',
        createdAt: new Date(h.clock.now().getTime() - 11 * 60_000),
      });

      await h.upload(session, { idempotencyKey: key, content }).expect(201);
    });

    describe('on PATCH /subscriptions/me', () => {
      const change = (session: SessionBody, plan: string, key?: string) => {
        const request = h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan });
        return key ? request.set('Idempotency-Key', key) : request;
      };

      it('a retried plan change is not applied — or billed — twice', async () => {
        const { session, companyId } = await company('free');
        const key = randomUUID();

        const first = await change(session, 'basic', key).expect(200);
        const retry = await change(session, 'basic', key).expect(200);

        expect(retry.body).toEqual(first.body);
        expect(retry.headers['idempotent-replayed']).toBe('true');
        expect(await h.dataSource.getRepository(SubscriptionChange).count({ where: { companyId } })).toBe(2); // choose + one change
      });

      it('without a key the same retry is a 409 (already on that plan)', async () => {
        const { session } = await company('free');
        await change(session, 'basic').expect(200);
        await change(session, 'basic').expect(409);
      });

      it('the same key for a different plan is 422', async () => {
        const { session } = await company('free');
        const key = randomUUID();
        await change(session, 'basic', key).expect(200);

        await change(session, 'premium', key).expect(422);
      });
    });
  });

  // ---- listing -----------------------------------------------------------

  describe('GET /files', () => {
    const list = async (session: SessionBody, query: Record<string, string | number> = {}) =>
      pageSchema.parse((await h.http().get('/files').set(...h.bearer(session)).query(query).expect(200)).body);

    async function walk(session: SessionBody, query: Record<string, string | number>) {
      const seen: string[] = [];
      let cursor: string | undefined;
      let pages = 0;
      for (; pages < 30; pages += 1) {
        const page = await list(session, cursor ? { ...query, cursor } : query);
        seen.push(...page.data.map((row) => row.id));
        if (!page.meta.hasMore) break;
        expect(page.meta.nextCursor).not.toBeNull();
        cursor = page.meta.nextCursor ?? undefined;
      }
      return { seen, pages: pages + 1 };
    }

    it('walks 25 real uploads in pages of 7 with no duplicates and no gaps — newest first', async () => {
      const { session } = await company('premium');
      const ids: string[] = [];
      for (let i = 0; i < 25; i += 1) ids.push((await uploaded(session)).id);

      const { seen, pages } = await walk(session, { limit: 7 });

      expect(pages).toBe(4);
      expect(new Set(seen).size).toBe(25);
      expect(seen).toEqual([...ids].reverse());
    });

    it('walks the other way with sort=createdAt', async () => {
      const { session } = await company('premium');
      const ids: string[] = [];
      for (let i = 0; i < 12; i += 1) ids.push((await uploaded(session)).id);

      const { seen } = await walk(session, { limit: 5, sort: 'createdAt' });

      expect(seen).toEqual(ids);
    });

    it('never repeats a row when many are created in one instant', async () => {
      const { session, companyId } = await company('premium');
      await h.seedUsage(companyId, 30, '2026-03-01'); // 30 rows written in one statement
      const { seen } = await walk(session, { limit: 4 });

      expect(new Set(seen).size).toBe(30);
    });

    it('filters by type, visibility and uploader — and only ever narrows', async () => {
      const t = await team();
      const csv = await uploaded(t.a.session, { name: 'a.csv' });
      const xlsx = await uploaded(t.b.session, { content: xlsxBytes(), name: 'b.xlsx' });
      const secret = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.c.userId] });

      expect((await list(t.session, { mimeType: XLSX_MIME })).data.map((r) => r.id)).toEqual([xlsx.id]);
      expect((await list(t.session, { visibility: 'restricted' })).data.map((r) => r.id)).toEqual([secret.id]);
      expect((await list(t.session, { uploaderId: t.a.userId })).data.map((r) => r.id).sort()).toEqual([csv.id, secret.id].sort());
      // B filtering for restricted files still cannot see A's restricted file.
      expect((await list(t.b.session, { visibility: 'restricted' })).data).toEqual([]);
      // Nor can a filter on the uploader widen what B may see.
      expect((await list(t.b.session, { uploaderId: t.a.userId })).data.map((r) => r.id)).toEqual([csv.id]);
    });

    it('filters by upload time', async () => {
      const { session } = await company('premium');
      const early = await uploaded(session);
      // The DB stamps createdAt with its own clock, so filter around the real "now".
      await new Promise((resolve) => setTimeout(resolve, 20));
      const cut = new Date().toISOString();
      await new Promise((resolve) => setTimeout(resolve, 20));
      const late = await uploaded(session);

      expect((await list(session, { uploadedAfter: cut })).data.map((r) => r.id)).toEqual([late.id]);
      expect((await list(session, { uploadedBefore: cut })).data.map((r) => r.id)).toEqual([early.id]);
    });

    it.each([
      ['a sort field that is not offered', { sort: 'originalName' }],
      ['a malformed cursor', { cursor: '!!!not-a-cursor' }],
      ['a limit over 100', { limit: 500 }],
      ['a limit of zero', { limit: 0 }],
      ['an unknown mime type', { mimeType: 'application/pdf' }],
      ['an unknown query parameter', { companyId: randomUUID() }],
      ['a malformed uploader id', { uploaderId: 'x' }],
      ['a malformed date', { uploadedAfter: 'yesterday' }],
    ])('rejects %s', async (_name, query) => {
      const { session } = await company();
      await h.http().get('/files').set(...h.bearer(session)).query(query).expect(400);
    });

    it('returns an empty page, not an error, for a company with no files', async () => {
      const { session } = await company();
      expect(await list(session)).toEqual({ data: [], meta: { nextCursor: null, hasMore: false } });
    });
  });

  // ---- employee removal ---------------------------------------------------

  describe('removing an employee', () => {
    it('deletes the grants they held; the files they uploaded stay with the company', async () => {
      const t = await team();
      const shared = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId] });
      const bs = await uploaded(t.b.session);

      await h.http().delete(`/employees/${t.b.userId}`).set(...h.bearer(t.session)).expect(200);

      expect(await h.dataSource.getRepository(FileAccessGrant).count({ where: { userId: t.b.userId } })).toBe(0);
      // A's file is now visible to A and admin only; B's own upload is still there for the admin.
      await get(t.session, bs.id).expect(200);
      expect(fileSchema.parse((await get(t.a.session, shared.id)).body).grantedUserIds).toEqual([]);
    });

    it('does not bring their access back when they are reactivated', async () => {
      const t = await team();
      const file = await uploaded(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId] });
      await h.http().delete(`/employees/${t.b.userId}`).set(...h.bearer(t.session)).expect(200);
      await h.http().post(`/employees/${t.b.userId}/reactivate`).set(...h.bearer(t.session)).expect(200);
      await h.drainTasks();
      const back = await h.http().post('/auth/accept-invite').send({
        token: h.mail.latestTokenTo(t.b.email),
        password: DEFAULT_PASSWORD,
      });

      await get(h.parseSession(back.body), file.id).expect(404);
    });
  });
});
