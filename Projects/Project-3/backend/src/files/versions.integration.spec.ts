import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { settle } from '#test/support/socket-client.js';
import { xlsBytes } from '#test/support/spreadsheet-fixtures.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { Notification } from '#/notifications/notification.entity.js';
import { FileAsset } from './file-asset.entity.js';

const fileSchema = z.object({
  id: z.uuid(),
  originalName: z.string(),
  visibility: z.enum(['company', 'restricted']),
  uploaderId: z.uuid(),
  datasetId: z.uuid(),
  version: z.number().int(),
  isLatest: z.boolean(),
  grantedUserIds: z.array(z.uuid()).nullable(),
});
type FileBody = z.infer<typeof fileSchema>;
const cursorPage = z.object({ data: z.array(fileSchema), meta: z.object({ hasMore: z.boolean(), nextCursor: z.string().nullable() }) });
const offsetPage = z.object({
  data: z.array(fileSchema),
  meta: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
});
const changeSchema = z.object({ from: z.number().nullable(), to: z.number().nullable(), delta: z.number().nullable() });
const comparisonSchema = z.object({
  from: z.object({ fileId: z.uuid(), version: z.number(), originalName: z.string() }),
  to: z.object({ fileId: z.uuid(), version: z.number(), originalName: z.string() }),
  columnsAdded: z.array(z.string()),
  columnsRemoved: z.array(z.string()),
  typeChanges: z.array(z.object({ column: z.string(), from: z.string(), to: z.string() })),
  nullPercentChanges: z.array(z.object({ column: z.string(), from: z.number(), to: z.number(), delta: z.number() })),
  rowCount: changeSchema,
  columnCount: changeSchema,
  duplicateRows: changeSchema,
  qualityScore: changeSchema,
  schemaChanged: z.boolean(),
});

const SALES_V1 = ['id,name,amount', '1,a,10', '2,b,20', ''].join('\n');
/** `amount` is gone and `total` is new: a schema change (a column was removed). */
const SALES_V2 = ['id,name,total', '1,a,10', '2,b,20', ''].join('\n');
/** Only a new column: nothing a reader of v1 breaks on. */
const SALES_ADDS = ['id,name,amount,note', '1,a,10,x', '2,b,20,y', ''].join('\n');
/** `amount` is now text: a type change. */
const SALES_TEXT = ['id,name,amount', '1,a,ten', '2,b,twenty', ''].join('\n');

describe('file versions and change detection (integration)', () => {
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

  const bearer = (session: SessionBody) => h.bearer(session);

  /** `POST /files/:id/versions`, ready to `.expect(...)`. */
  function versionOf(
    session: SessionBody,
    baseId: string,
    options: Partial<{ content: string | Buffer; name: string; contentType: string; bearer: string; idempotencyKey: string; field: [string, string] }> = {},
  ) {
    const request = h
      .http()
      .post(`/files/${baseId}/versions`)
      .set(...(options.bearer ? (['Authorization', `Bearer ${options.bearer}`] as [string, string]) : bearer(session)));
    if (options.idempotencyKey) request.set('Idempotency-Key', options.idempotencyKey);
    request.attach('file', Buffer.from(options.content ?? `id,value\n1,${randomUUID()}\n`), {
      filename: options.name ?? 'next.csv',
      contentType: options.contentType ?? 'text/csv',
    });
    if (options.field) request.field(...options.field);
    return request;
  }

  const first = async (session: SessionBody, options: Parameters<AppHarness['upload']>[1] = {}): Promise<FileBody> =>
    fileSchema.parse((await h.upload(session, options).expect(201)).body);
  const next = async (session: SessionBody, baseId: string, content?: string): Promise<FileBody> =>
    fileSchema.parse((await versionOf(session, baseId, content === undefined ? {} : { content }).expect(201)).body);
  const listed = async (session: SessionBody, query: Record<string, string> = {}) =>
    cursorPage.parse((await h.http().get('/files').set(...bearer(session)).query(query).expect(200)).body).data;
  const versions = async (session: SessionBody, id: string, query: Record<string, string> = {}) =>
    offsetPage.parse((await h.http().get(`/files/${id}/versions`).set(...bearer(session)).query(query).expect(200)).body);
  const rows = (datasetId: string) =>
    h.dataSource.getRepository(FileAsset).find({ where: { datasetId }, order: { version: 'ASC' } });
  const compare = (session: SessionBody, from: string, to: string) =>
    h.http().get(`/files/${from}/compare/${to}`).set(...bearer(session));
  const inbox = (userId: string, type: string) => h.dataSource.getRepository(Notification).find({ where: { userId, type } });

  // ---- creating versions ----------------------------------------------------------

  describe('POST /files/:id/versions', () => {
    it('a first upload is version 1 of a dataset of its own', async () => {
      const { session } = await company();

      const file = await first(session);

      expect(file).toMatchObject({ version: 1, isLatest: true });
      expect(file.datasetId).toBe(file.id);
    });

    it('adds version 2 to the same dataset, makes it the latest, and demotes version 1', async () => {
      const { session } = await company();
      const v1 = await first(session, { name: 'sales.csv' });

      const v2 = await next(session, v1.id);

      expect(v2).toMatchObject({ datasetId: v1.datasetId, version: 2, isLatest: true, visibility: 'company' });
      expect(v2.id).not.toBe(v1.id);
      expect((await rows(v1.datasetId)).map((row) => [row.version, row.isLatest])).toEqual([[1, false], [2, true]]);
    });

    it('pointing at any version of the dataset works, and the next number always follows the highest', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const v2 = await next(session, v1.id);

      const v3 = await next(session, v1.id); // pointed at the OLD one

      expect(v3).toMatchObject({ version: 3, datasetId: v1.datasetId });
      expect((await rows(v1.datasetId)).filter((row) => row.isLatest).map((row) => row.id)).toEqual([v3.id]);
      expect(v2.version).toBe(2);
    });

    it('is a real upload: its own stored object, usage event, report task and audit entry (with the dataset and version)', async () => {
      const { session, companyId } = await company();
      const v1 = await first(session);

      const v2 = await next(session, v1.id);
      await h.drainTasks();

      expect(await h.dataSource.getRepository(UsageEvent).count({ where: { companyId } })).toBe(2);
      const stored = await h.dataSource.getRepository(FileAsset).findOneByOrFail({ id: v2.id });
      expect(await h.storage.get(stored.storageKey)).toBeDefined();
      const audit = await h.dataSource.getRepository(AuditLogEntry).find({ where: { action: 'file.uploaded' }, order: { createdAt: 'ASC' } });
      expect(audit.map((entry) => entry.metadata)).toMatchObject([
        { datasetId: v1.datasetId, version: 1 },
        { datasetId: v1.datasetId, version: 2 },
      ]);
      const report = await h.http().get(`/files/${v2.id}/report`).set(...bearer(session)).expect(200);
      expect(report.body.status).toBe('ready');
    });

    it('counts toward the file quota like any upload', async () => {
      const { session, companyId } = await company('free');
      await h.seedUsage(companyId, 9, '2026-03-01');
      const v1 = await first(session); // the 10th and last slot

      const refused = await versionOf(session, v1.id).expect(402);

      expect(refused.body.message).toMatch(/free plan allows 10 files/);
      expect(await rows(v1.datasetId)).toHaveLength(1);
    });

    it('a rejected version leaves nothing behind: no row, no object, no quota used', async () => {
      const { session, companyId } = await company();
      const v1 = await first(session);

      await versionOf(session, v1.id, { content: Buffer.from('MZ\u0090\u0000\u0003binary'), name: 'evil.csv' }).expect(400);

      expect(await rows(v1.datasetId)).toHaveLength(1);
      expect(await h.dataSource.getRepository(UsageEvent).count({ where: { companyId } })).toBe(1);
    });

    it('a version that hits the plan’s per-file limit is a 409 naming the plan and the number; deleting one makes room', async () => {
      const { session } = await company('free'); // 5 versions per file
      const v1 = await first(session);
      const created = [v1];
      for (let i = 0; i < 4; i += 1) created.push(await next(session, v1.id));

      const refused = await versionOf(session, v1.id).expect(409);
      expect(refused.body.message).toMatch(/free plan keeps up to 5 versions of a file and this one has 5/);
      expect(refused.body.message).toMatch(/upgrade/i);

      await h.http().delete(`/files/${created[1]?.id}`).set(...bearer(session)).expect(200);
      expect((await next(session, v1.id)).version).toBe(6);
    });

    it('Premium has no limit on versions', async () => {
      const { session } = await company('premium');
      const v1 = await first(session);
      for (let i = 0; i < 6; i += 1) await next(session, v1.id);
      expect((await rows(v1.datasetId)).length).toBe(7);
    });

    it('two uploads racing for the next version get 2 and 3 — never the same number — and one is the latest', async () => {
      const { session } = await company();
      const v1 = await first(session);

      const [a, b] = await Promise.all([versionOf(session, v1.id), versionOf(session, v1.id)]);

      expect([a.status, b.status]).toEqual([201, 201]);
      const all = await rows(v1.datasetId);
      expect(all.map((row) => row.version)).toEqual([1, 2, 3]);
      expect(all.filter((row) => row.isLatest)).toHaveLength(1);
      expect(all.at(-1)?.isLatest).toBe(true);
    });

    it('waits for the dataset’s row locks: even a lock on an OLDER version (which the new version would not otherwise write to) holds it back', async () => {
      const { session } = await company();
      const v1 = await first(session);
      await next(session, v1.id); // v2 is the latest; v1 is the row nothing below would touch
      const runner = h.dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query(`SELECT 1 FROM file_asset WHERE id = $1 FOR UPDATE`, [v1.id]);
        let finished = false;
        const pending = versionOf(session, v1.id).then((response) => {
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

    it('a retry with the same Idempotency-Key replays the first answer instead of adding another version', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const options = { content: 'id,value\n1,same\n', idempotencyKey: randomUUID() };

      const one = await versionOf(session, v1.id, options).expect(201);
      const two = await versionOf(session, v1.id, options).expect(201);

      expect(two.body.id).toBe(one.body.id);
      expect(await rows(v1.datasetId)).toHaveLength(2);
    });

    it('takes no fields: visibility and grants are inherited, so sending one is a 400', async () => {
      const { session } = await company();
      const v1 = await first(session);

      await versionOf(session, v1.id, { field: ['visibility', 'restricted'] }).expect(400);
      await versionOf(session, v1.id, { field: ['datasetId', randomUUID()] }).expect(400);
    });

    it('rejects a missing file (400) and a file that is not a spreadsheet by its bytes', async () => {
      const { session } = await company();
      const v1 = await first(session);

      await h.http().post(`/files/${v1.id}/versions`).set(...bearer(session)).expect(400);
      await versionOf(session, v1.id, { content: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]), name: 'x.csv' }).expect(400);
    });

    it('accepts a legacy .xls too, exactly as a first upload does', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const v2 = fileSchema.parse((await versionOf(session, v1.id, { content: xlsBytes(), name: 'old.xls', contentType: 'application/vnd.ms-excel' }).expect(201)).body);
      expect(v2.version).toBe(2);
    });
  });

  // ---- who may ----------------------------------------------------------------------

  describe('who may add a version', () => {
    it('the uploader and admins; another employee who can see the file gets 403; someone who cannot gets 404', async () => {
      const { session, companyId } = await company();
      const uploader = await h.inviteAndAccept(session, companyId);
      const colleague = await h.inviteAndAccept(session, companyId);
      const shared = await first(uploader.session);
      const hidden = await first(uploader.session, { visibility: 'restricted' });

      await versionOf(colleague.session, shared.id).expect(403);
      await versionOf(colleague.session, hidden.id).expect(404);
      await versionOf(colleague.session, randomUUID()).expect(404);
      await versionOf(uploader.session, shared.id).expect(201);
      await versionOf(session, shared.id).expect(201);
      expect((await rows(shared.datasetId)).map((row) => row.version)).toEqual([1, 2, 3]);
    });

    it('a deleted file cannot be the base of a version (404)', async () => {
      const { session } = await company();
      const v1 = await first(session);
      await h.http().delete(`/files/${v1.id}`).set(...bearer(session)).expect(200);
      await versionOf(session, v1.id).expect(404);
    });

    it('never crosses companies', async () => {
      const mine = await company();
      const theirs = await company();
      const v1 = await first(theirs.session);

      await versionOf(mine.session, v1.id).expect(404);
      await h.http().get(`/files/${v1.id}/versions`).set(...bearer(mine.session)).expect(404);
      expect(await rows(v1.datasetId)).toHaveLength(1);
    });

    it('an API key needs files:write to add one, and files:read to list versions or compare', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const { key: reader } = await h.createApiKey(session, { scopes: ['files:read'] });
      const { key: writer } = await h.createApiKey(session, { scopes: ['files:write'] });

      await versionOf(session, v1.id, { bearer: reader }).expect(403);
      await versionOf(session, v1.id, { bearer: writer }).expect(201);
      await h.http().get(`/files/${v1.id}/versions`).set('Authorization', `Bearer ${reader}`).expect(200);
    });
  });

  // ---- access ---------------------------------------------------------------------

  describe('a version inherits who can see the file', () => {
    it('restricted, with the same grants: the grantee sees the new version, a third employee does not', async () => {
      const { session, companyId } = await company();
      const uploader = await h.inviteAndAccept(session, companyId);
      const grantee = await h.inviteAndAccept(session, companyId);
      const outsider = await h.inviteAndAccept(session, companyId);
      const v1 = await first(uploader.session, { visibility: 'restricted', grantedUserIds: [grantee.userId] });

      const v2 = await next(uploader.session, v1.id);

      expect(v2).toMatchObject({ visibility: 'restricted', grantedUserIds: [grantee.userId] });
      expect((await listed(grantee.session)).map((file) => file.id)).toEqual([v2.id]);
      expect(await listed(outsider.session)).toEqual([]);
      await h.http().get(`/files/${v2.id}`).set(...bearer(outsider.session)).expect(404);
      await h.http().get(`/files/${v2.id}/versions`).set(...bearer(outsider.session)).expect(404);
    });

    it('when an ADMIN adds the version, the original uploader keeps their access', async () => {
      const { session, companyId } = await company();
      const uploader = await h.inviteAndAccept(session, companyId);
      const v1 = await first(uploader.session, { visibility: 'restricted' });

      const v2 = await next(session, v1.id);

      expect(v2.uploaderId).not.toBe(v1.uploaderId);
      expect((await listed(uploader.session)).map((file) => file.id)).toEqual([v2.id]);
      expect(v2.grantedUserIds).toEqual([uploader.userId]);
    });

    it('each version’s access is its own afterwards: changing one leaves the others alone', async () => {
      const { session, companyId } = await company();
      const uploader = await h.inviteAndAccept(session, companyId);
      const colleague = await h.inviteAndAccept(session, companyId);
      const v1 = await first(uploader.session, { visibility: 'restricted' });
      const v2 = await next(uploader.session, v1.id);

      await h.http().patch(`/files/${v2.id}`).set(...bearer(uploader.session)).send({ visibility: 'company' }).expect(200);

      await h.http().get(`/files/${v2.id}`).set(...bearer(colleague.session)).expect(200);
      await h.http().get(`/files/${v1.id}`).set(...bearer(colleague.session)).expect(404);
      expect((await versions(colleague.session, v2.id)).data.map((file) => file.version)).toEqual([2]);
    });

    it('a colleague who was granted the file but has since been removed is not carried over', async () => {
      const { session, companyId } = await company();
      const uploader = await h.inviteAndAccept(session, companyId);
      const gone = await h.inviteAndAccept(session, companyId);
      const kept = await h.inviteAndAccept(session, companyId);
      const v1 = await first(uploader.session, { visibility: 'restricted', grantedUserIds: [gone.userId, kept.userId] });
      await h.http().delete(`/employees/${gone.userId}`).set(...bearer(session)).expect(200);

      const v2 = await next(uploader.session, v1.id);

      expect(v2.grantedUserIds).toEqual([kept.userId]);
    });

    it('does not tell the grantees the file was "shared" again', async () => {
      const { session, companyId } = await company();
      const uploader = await h.inviteAndAccept(session, companyId);
      const grantee = await h.inviteAndAccept(session, companyId);
      const v1 = await first(uploader.session, { visibility: 'restricted', grantedUserIds: [grantee.userId] });
      await next(uploader.session, v1.id);

      expect(await inbox(grantee.userId, 'file.shared')).toHaveLength(1); // from the first upload only
    });
  });

  // ---- listing -----------------------------------------------------------------------

  describe('listing', () => {
    it('GET /files shows each file once, as its newest version; allVersions=true shows every one', async () => {
      const { session } = await company();
      const a = await first(session, { name: 'a.csv' });
      const a2 = await next(session, a.id);
      const b = await first(session, { name: 'b.csv' });

      expect((await listed(session)).map((file) => file.id).sort()).toEqual([a2.id, b.id].sort());
      expect((await listed(session, { allVersions: 'true' })).map((file) => file.id).sort()).toEqual([a.id, a2.id, b.id].sort());
      expect((await listed(session, { allVersions: 'false' })).map((file) => file.id).sort()).toEqual([a2.id, b.id].sort());
      await h.http().get('/files').set(...bearer(session)).query({ allVersions: 'maybe' }).expect(400);
    });

    it('GET /files/:id/versions lists a dataset’s versions newest first, from any of them, and pages by offset', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const v2 = await next(session, v1.id);
      const v3 = await next(session, v1.id);
      await first(session); // another dataset: never mixed in

      const all = await versions(session, v2.id);
      expect(all.data.map((file) => file.version)).toEqual([3, 2, 1]);
      expect(all.data.map((file) => file.id)).toEqual([v3.id, v2.id, v1.id]);
      expect(all.meta).toMatchObject({ total: 3, page: 1 });

      const page2 = await versions(session, v1.id, { limit: '2', page: '2' });
      expect(page2.data.map((file) => file.version)).toEqual([1]);
      expect(page2.meta).toMatchObject({ total: 3, totalPages: 2 });
    });

    it('a deleted version is not listed', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const v2 = await next(session, v1.id);
      await h.http().delete(`/files/${v1.id}`).set(...bearer(session)).expect(200);

      expect((await versions(session, v2.id)).data.map((file) => file.version)).toEqual([2]);
      expect((await listed(session, { allVersions: 'true' })).map((file) => file.version)).toEqual([2]);
    });
  });

  // ---- deleting ----------------------------------------------------------------------

  describe('deleting a version', () => {
    it('deleting the LATEST promotes the highest remaining live version', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const v2 = await next(session, v1.id);
      const v3 = await next(session, v1.id);

      await h.http().delete(`/files/${v3.id}`).set(...bearer(session)).expect(200);

      expect((await rows(v1.datasetId)).map((row) => [row.version, row.isLatest, row.deletedAt !== null])).toEqual([
        [1, false, false],
        [2, true, false],
        [3, false, true],
      ]);
      expect((await listed(session)).map((file) => file.id)).toEqual([v2.id]);
    });

    it('deleting an older version changes nothing about which is latest', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const v2 = await next(session, v1.id);

      await h.http().delete(`/files/${v1.id}`).set(...bearer(session)).expect(200);

      expect((await listed(session)).map((file) => file.id)).toEqual([v2.id]);
      expect((await rows(v1.datasetId)).find((row) => row.id === v2.id)?.isLatest).toBe(true);
    });

    it('a version number is never reused, even after the highest was deleted', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const v2 = await next(session, v1.id);
      await h.http().delete(`/files/${v2.id}`).set(...bearer(session)).expect(200);

      const again = await next(session, v1.id);

      expect(again.version).toBe(3);
      expect((await rows(v1.datasetId)).filter((row) => row.isLatest).map((row) => row.id)).toEqual([again.id]);
    });

    it('deleting every version leaves nothing listed, and audits each with its dataset and version', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const v2 = await next(session, v1.id);
      await h.http().delete(`/files/${v2.id}`).set(...bearer(session)).expect(200);
      await h.http().delete(`/files/${v1.id}`).set(...bearer(session)).expect(200);

      expect(await listed(session, { allVersions: 'true' })).toEqual([]);
      expect((await rows(v1.datasetId)).some((row) => row.isLatest)).toBe(false);
      const deleted = await h.dataSource.getRepository(AuditLogEntry).find({ where: { action: 'file.deleted' } });
      expect(deleted.map((entry) => entry.metadata)).toMatchObject([{ datasetId: v1.datasetId, version: 2 }, { datasetId: v1.datasetId, version: 1 }]);
    });

    it('waits for the dataset’s row locks: deleting an OLDER version is held back by a lock on the latest one', async () => {
      const { session } = await company();
      const v1 = await first(session);
      const v2 = await next(session, v1.id);
      const runner = h.dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        // Deleting v1 writes only to v1, so only the explicit dataset lock can make it wait for v2.
        await runner.query(`SELECT 1 FROM file_asset WHERE id = $1 FOR UPDATE`, [v2.id]);
        let finished = false;
        const pending = h
          .http()
          .delete(`/files/${v1.id}`)
          .set(...bearer(session))
          .then((response) => {
            finished = true;
            return response;
          });
        await settle(500);
        expect(finished).toBe(false);

        await runner.commitTransaction();
        expect((await pending).status).toBe(200);
      } finally {
        await runner.release();
      }
    });
  });

  // ---- comparing ---------------------------------------------------------------------

  describe('GET /files/:id/compare/:otherId', () => {
    it('reports removed and added columns, and the change in rows, from the stored reports', async () => {
      const { session } = await company();
      const v1 = await first(session, { content: SALES_V1 });
      const v2 = await next(session, v1.id, SALES_V2);
      await h.drainTasks();

      const diff = comparisonSchema.parse((await compare(session, v1.id, v2.id).expect(200)).body);

      expect(diff).toMatchObject({
        from: { fileId: v1.id, version: 1 },
        to: { fileId: v2.id, version: 2 },
        columnsRemoved: ['amount'],
        columnsAdded: ['total'],
        typeChanges: [],
        schemaChanged: true,
        rowCount: { from: 2, to: 2, delta: 0 },
        columnCount: { from: 3, to: 3, delta: 0 },
      });
    });

    it('reports a type change, and a new column alone is not a schema change', async () => {
      const { session } = await company();
      const v1 = await first(session, { content: SALES_V1 });
      const adds = await next(session, v1.id, SALES_ADDS);
      const text = await next(session, v1.id, SALES_TEXT);
      await h.drainTasks();

      const added = comparisonSchema.parse((await compare(session, v1.id, adds.id).expect(200)).body);
      expect(added).toMatchObject({ columnsAdded: ['note'], columnsRemoved: [], typeChanges: [], schemaChanged: false });

      const retyped = comparisonSchema.parse((await compare(session, v1.id, text.id).expect(200)).body);
      expect(retyped.typeChanges).toEqual([{ column: 'amount', from: 'integer', to: 'string' }]);
      expect(retyped.schemaChanged).toBe(true);
    });

    it('reports a rise in empty cells and the quality score change', async () => {
      const { session } = await company();
      await h.http().post('/quality-rules').set(...bearer(session)).send({ name: 'Names filled', kind: 'max_null_percent', columnName: 'name', params: { max: 0 } }).expect(201);
      const v1 = await first(session, { content: SALES_V1 });
      const v2 = await next(session, v1.id, ['id,name,amount', '1,,10', '2,,20', ''].join('\n'));
      await h.drainTasks();

      const diff = comparisonSchema.parse((await compare(session, v1.id, v2.id).expect(200)).body);

      expect(diff.nullPercentChanges).toEqual([{ column: 'name', from: 0, to: 100, delta: 100 }]);
      expect(diff.qualityScore).toEqual({ from: 100, to: 0, delta: -100 });
    });

    it('the direction is from :id to :otherId, and comparing a file with itself shows no change', async () => {
      const { session } = await company();
      const v1 = await first(session, { content: SALES_V1 });
      const v2 = await next(session, v1.id, SALES_V2);
      await h.drainTasks();

      const back = comparisonSchema.parse((await compare(session, v2.id, v1.id).expect(200)).body);
      expect(back).toMatchObject({ columnsAdded: ['amount'], columnsRemoved: ['total'] });
      const same = comparisonSchema.parse((await compare(session, v1.id, v1.id).expect(200)).body);
      expect(same).toMatchObject({ columnsAdded: [], columnsRemoved: [], schemaChanged: false });
    });

    it('is a 404 for a file the caller cannot see, and 422 for two files that are not versions of one another', async () => {
      const { session, companyId } = await company();
      const owner = await h.inviteAndAccept(session, companyId);
      const colleague = await h.inviteAndAccept(session, companyId);
      const v1 = await first(owner.session, { visibility: 'restricted' });
      const v2 = await next(owner.session, v1.id);
      const other = await first(owner.session);
      await h.drainTasks();

      await compare(colleague.session, v1.id, v2.id).expect(404);
      await compare(owner.session, v1.id, randomUUID()).expect(404);
      const across = await compare(owner.session, v1.id, other.id).expect(422);
      expect(across.body.message).toMatch(/not versions of the same file/);
    });

    it('needs both reports finished: 409 while one is being built, 422 when one failed or is unsupported', async () => {
      const { session } = await company();
      const v1 = await first(session, { content: SALES_V1 });
      await h.drainTasks();
      const v2 = await next(session, v1.id, SALES_V2); // its report is still queued

      const early = await compare(session, v1.id, v2.id).expect(409);
      expect(early.body.message).toMatch(/version 2 is still being prepared/);

      await h.drainTasks();
      const legacy = await next(session, v1.id, undefined);
      void legacy;
      const xls = fileSchema.parse((await versionOf(session, v1.id, { content: xlsBytes(), name: 'old.xls', contentType: 'application/vnd.ms-excel' }).expect(201)).body);
      await h.drainTasks();
      const unsupported = await compare(session, v1.id, xls.id).expect(422);
      expect(unsupported.body.message).toMatch(/Version \d+ has no report to compare/);
    });

    it('never crosses companies', async () => {
      const mine = await company();
      const theirs = await company();
      const a = await first(mine.session);
      const b = await first(theirs.session);
      await compare(mine.session, a.id, b.id).expect(404);
    });
  });

  // ---- schema-change alerts ------------------------------------------------------------

  describe('dataset.schema_changed notifications', () => {
    it('a version that drops a column tells the uploader and the admins, naming what moved', async () => {
      const { admin, session, companyId } = await company();
      const employee = await h.inviteAndAccept(session, companyId);
      const v1 = await first(employee.session, { content: SALES_V1, name: 'sales.csv' });
      await h.drainTasks();

      const v2 = await next(employee.session, v1.id, SALES_V2);
      await h.drainTasks();

      for (const userId of [employee.userId, admin.userId]) {
        const [entry] = await inbox(userId, 'dataset.schema_changed');
        expect(entry?.payload).toEqual({
          datasetId: v1.datasetId,
          fileId: v2.id,
          fileName: 'next.csv',
          version: 2,
          previousVersion: 1,
          columnsAdded: ['total'],
          columnsRemoved: ['amount'],
          typeChanges: [],
        });
      }
    });

    it('a retyped column alerts too; a new column, or a version with no change, does not', async () => {
      const { admin, session } = await company();
      const v1 = await first(session, { content: SALES_V1 });
      await h.drainTasks();

      await next(session, v1.id, SALES_ADDS); // v2: a new column
      await h.drainTasks();
      await next(session, v1.id, SALES_ADDS); // v3: identical columns and types
      await h.drainTasks();
      expect(await inbox(admin.userId, 'dataset.schema_changed')).toEqual([]);

      // v4 keeps every column but `amount` is now text.
      await next(session, v1.id, ['id,name,amount,note', '1,a,ten,x', '2,b,twenty,y', ''].join('\n'));
      await h.drainTasks();
      const [entry] = await inbox(admin.userId, 'dataset.schema_changed');
      expect(entry?.payload).toMatchObject({
        version: 4,
        previousVersion: 3,
        columnsRemoved: [],
        typeChanges: [{ column: 'amount', from: 'integer', to: 'string' }],
      });
    });

    it('is compared with the nearest earlier LIVE version, so deleting the one before it changes the baseline', async () => {
      const { admin, session } = await company();
      const v1 = await first(session, { content: SALES_V1 });
      const v2 = await next(session, v1.id, SALES_V2);
      await h.drainTasks();
      await h.http().delete(`/files/${v2.id}`).set(...bearer(session)).expect(200);
      await h.dataSource.getRepository(Notification).clear();

      await next(session, v1.id, SALES_V2); // v3, now compared with v1 (v2 is gone)
      await h.drainTasks();

      const [entry] = await inbox(admin.userId, 'dataset.schema_changed');
      expect(entry?.payload).toMatchObject({ version: 3, previousVersion: 1, columnsRemoved: ['amount'] });
    });

    it('a first version has nothing to compare with', async () => {
      const { admin, session } = await company();
      await first(session, { content: SALES_V1 });
      await h.drainTasks();
      expect(await inbox(admin.userId, 'dataset.schema_changed')).toEqual([]);
    });
  });
});
