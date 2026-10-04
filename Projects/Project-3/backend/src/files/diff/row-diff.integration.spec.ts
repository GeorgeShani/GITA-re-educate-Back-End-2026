import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { Notification } from '#/notifications/notification.entity.js';

const V1 = ['customer_id,name,city', '1,Ana,Tbilisi', '2,Ben,Batumi', '3,Cleo,Kutaisi', ''].join('\n');
const V2 = ['customer_id,name,city', '1,Ana,Tbilisi', '2,Ben,Poti', '4,Dan,Rustavi', ''].join('\n');

const fileSchema = z.object({ id: z.uuid(), datasetId: z.uuid(), version: z.number() }).loose();
const diffSchema = z.object({
  from: z.object({ fileId: z.uuid(), version: z.number(), originalName: z.string() }),
  to: z.object({ fileId: z.uuid(), version: z.number(), originalName: z.string() }),
  status: z.enum(['none', 'queued', 'running', 'ready', 'failed']),
  keyColumns: z.array(z.string()),
  suggestedKeyColumns: z.array(z.string()),
  summary: z
    .object({
      keyColumns: z.array(z.string()),
      rowsBefore: z.number(),
      rowsAfter: z.number(),
      added: z.number(),
      removed: z.number(),
      changed: z.number(),
      unchanged: z.number(),
      unmatchable: z.number(),
      columnsChanged: z.array(z.object({ column: z.string(), changed: z.number() })),
      columnsAdded: z.array(z.string()),
      columnsRemoved: z.array(z.string()),
    })
    .nullable(),
  sample: z.array(
    z.object({
      change: z.enum(['added', 'removed', 'changed']),
      key: z.array(z.string()),
      cells: z.array(z.object({ column: z.string(), before: z.string().nullable(), after: z.string().nullable() })),
    }),
  ),
  errorMessage: z.string().nullable(),
});

describe('row-level comparison of versions (integration)', () => {
  let h: AppHarness;
  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  async function company() {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, 'basic');
    return { admin, session, companyId: admin.companyId };
  }

  async function twoVersions(session: SessionBody, options: { visibility?: 'company' | 'restricted'; grantedUserIds?: string[] } = {}) {
    const v1 = fileSchema.parse((await h.upload(session, { content: V1, name: 'customers.csv', ...options }).expect(201)).body);
    await h.drainTasks();
    const v2 = fileSchema.parse(
      (await h.http().post(`/files/${v1.id}/versions`).set(...h.bearer(session)).attach('file', Buffer.from(V2), { filename: 'customers.csv', contentType: 'text/csv' }).expect(201)).body,
    );
    await h.drainTasks();
    return { v1, v2 };
  }

  const rows = (session: SessionBody, a: string, b: string) => h.http().get(`/files/${a}/compare/${b}/rows`).set(...h.bearer(session));
  const start = (session: SessionBody, a: string, b: string, body: object = {}) => h.http().post(`/files/${a}/compare/${b}/rows`).set(...h.bearer(session)).send(body);
  const read = async (session: SessionBody, a: string, b: string) => diffSchema.parse((await rows(session, a, b).expect(200)).body);

  it('says nothing has been compared yet and suggests the column that looks like a key', async () => {
    const { session } = await company();
    const { v1, v2 } = await twoVersions(session);
    const view = await read(session, v1.id, v2.id);
    expect(view).toMatchObject({ status: 'none', keyColumns: [], suggestedKeyColumns: ['customer_id'], summary: null, sample: [] });
    expect(view.from.version).toBe(1);
    // Either order names the older version first.
    expect((await read(session, v2.id, v1.id)).from.fileId).toBe(v1.id);
  });

  it('compares the rows by the chosen key: counts, the changed cells, and which column moved most', async () => {
    const { session } = await company();
    const { v1, v2 } = await twoVersions(session);

    const started = diffSchema.parse((await start(session, v1.id, v2.id, { keyColumns: ['customer_id'] }).expect(202)).body);
    expect(started.status).toBe('queued');
    await h.drainTasks();

    const view = await read(session, v1.id, v2.id);
    expect(view.status).toBe('ready');
    expect(view.summary).toMatchObject({ added: 1, removed: 1, changed: 1, unchanged: 1, unmatchable: 0, rowsBefore: 3, rowsAfter: 3, columnsChanged: [{ column: 'city', changed: 1 }] });
    expect(view.sample.find((entry) => entry.change === 'changed')).toEqual({ change: 'changed', key: ['2'], cells: [{ column: 'city', before: 'Batumi', after: 'Poti' }] });
    expect(view.sample.find((entry) => entry.change === 'removed')?.key).toEqual(['3']);
    expect(view.sample.find((entry) => entry.change === 'added')?.key).toEqual(['4']);
  });

  it('refuses without keys, with a column a version does not have, and while one is already being made', async () => {
    const { session } = await company();
    const { v1, v2 } = await twoVersions(session);

    await start(session, v1.id, v2.id).expect(400);
    await start(session, v1.id, v2.id, { keyColumns: [] }).expect(400);

    await start(session, v1.id, v2.id, { keyColumns: ['ghost'] }).expect(202);
    await start(session, v1.id, v2.id, { keyColumns: ['customer_id'] }).expect(409);
    await h.drainTasks();
    const failed = await read(session, v1.id, v2.id);
    expect(failed).toMatchObject({ status: 'failed', summary: null });
    expect(failed.errorMessage).toBe('Version 1 has no column "ghost", so rows cannot be matched by it.');

    // Asking again with a real key replaces the failure.
    await start(session, v1.id, v2.id, { keyColumns: ['customer_id'] }).expect(202);
    await h.drainTasks();
    expect((await read(session, v1.id, v2.id)).status).toBe('ready');
  });

  it('uses the key saved for the dataset when none is given', async () => {
    const { session } = await company();
    const { v1, v2 } = await twoVersions(session);
    await h.http().put(`/datasets/${v1.datasetId}/settings`).set(...h.bearer(session)).send({ keyColumns: ['customer_id'] }).expect(200);
    expect((await read(session, v1.id, v2.id)).keyColumns).toEqual(['customer_id']);
    await start(session, v1.id, v2.id).expect(202);
    await h.drainTasks();
    expect((await read(session, v1.id, v2.id)).summary?.changed).toBe(1);
  });

  it('is a 404 for someone who cannot see one of the versions, and 422 for files that are not versions of each other', async () => {
    const { admin, session, companyId } = await company();
    const employee = await h.inviteAndAccept(session, companyId);
    const { v1, v2 } = await twoVersions(session, { visibility: 'restricted', grantedUserIds: [] });
    await rows(employee.session, v1.id, v2.id).expect(404);
    await start(employee.session, v1.id, v2.id, { keyColumns: ['customer_id'] }).expect(404);
    await h.http().get(`/files/${v1.id}/compare/${v2.id}/rows.csv`).set(...h.bearer(employee.session)).expect(404);

    const other = fileSchema.parse((await h.upload(session, { content: V1, name: 'other.csv' }).expect(201)).body);
    await rows(session, v1.id, other.id).expect(422);

    const stranger = await h.registerAndActivate();
    const strangerSession = await h.login(stranger.email);
    await h.subscribe(strangerSession, 'basic');
    await rows(strangerSession, v1.id, v2.id).expect(404);
    expect(admin.userId).toBeTruthy();
  });

  it('downloads every change as a CSV, once the comparison is ready', async () => {
    const { session } = await company();
    const { v1, v2 } = await twoVersions(session);
    await h.http().get(`/files/${v1.id}/compare/${v2.id}/rows.csv`).set(...h.bearer(session)).expect(409);

    await start(session, v1.id, v2.id, { keyColumns: ['customer_id'] }).expect(202);
    await h.drainTasks();
    const response = await h.http().get(`/files/${v1.id}/compare/${v2.id}/rows.csv`).set(...h.bearer(session)).expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment');
    const lines = response.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('change,key: customer_id,customer_id,name,city,city (was)');
    expect(lines.slice(1).sort()).toEqual(['added,4,4,Dan,Rustavi,', 'changed,2,,,Poti,Batumi', 'removed,3,3,Cleo,Kutaisi,'].sort());
  });

  describe('every new version', () => {
    it('is compared with the one before it once the dataset has a key, and the uploader and admins hear what changed', async () => {
      const { admin, session } = await company();
      const v1 = fileSchema.parse((await h.upload(session, { content: V1, name: 'customers.csv' }).expect(201)).body);
      await h.drainTasks();
      await h.http().put(`/datasets/${v1.datasetId}/settings`).set(...h.bearer(session)).send({ keyColumns: ['customer_id'] }).expect(200);

      const v2 = fileSchema.parse(
        (await h.http().post(`/files/${v1.id}/versions`).set(...h.bearer(session)).attach('file', Buffer.from(V2), { filename: 'customers.csv', contentType: 'text/csv' }).expect(201)).body,
      );
      await h.drainTasks();
      await h.drainTasks();

      const view = await read(session, v1.id, v2.id);
      expect(view).toMatchObject({ status: 'ready', summary: { added: 1, removed: 1, changed: 1 } });
      const [entry] = await h.dataSource.getRepository(Notification).find({ where: { userId: admin.userId, type: 'dataset.changed' } });
      expect(entry?.payload).toEqual({ datasetId: v1.datasetId, fileId: v2.id, fileName: 'customers.csv', version: 2, previousVersion: 1, added: 1, removed: 1, changed: 1 });
    });

    it('is left alone when the dataset has no key', async () => {
      const { admin, session } = await company();
      const { v1, v2 } = await twoVersions(session);
      expect((await read(session, v1.id, v2.id)).status).toBe('none');
      expect(await h.dataSource.getRepository(Notification).count({ where: { userId: admin.userId, type: 'dataset.changed' } })).toBe(0);
    });
  });
});
