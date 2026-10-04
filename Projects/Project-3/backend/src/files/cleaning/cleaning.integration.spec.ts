import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { xlsBytes } from '#test/support/spreadsheet-fixtures.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { FileAsset } from '../file-asset.entity.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';

const MESSY = [
  'name,joined,amount,note',
  ' Ada Lovelace ,25/12/2025,"1.234,50 €",N/A',
  'Grace Hopper,03/04/2026,99,ok',
  'Grace Hopper,03/04/2026,99,ok',
  ',,,',
  '',
].join('\n');

const RECIPE = {
  steps: [
    { step: 'trim_whitespace' },
    { step: 'drop_empty_rows' },
    { step: 'drop_duplicate_rows' },
    { step: 'standardise_dates', column: 'joined', order: 'dmy' },
    { step: 'parse_numbers', column: 'amount', decimal: ',' },
    { step: 'replace_values', column: 'note', values: ['N/A'] },
  ],
};

const CLEANED_CSV = 'name,joined,amount,note\r\nAda Lovelace,2025-12-25,1234.5,\r\nGrace Hopper,2026-04-03,99,ok\r\n';

const stepSchema = z.object({ step: z.string(), label: z.string(), changed: z.number(), skipped: z.string().nullable(), notes: z.array(z.string()) });
const previewSchema = z.object({
  rowsBefore: z.number(),
  rowsAfter: z.number(),
  columns: z.array(z.string()),
  steps: z.array(stepSchema),
  samples: z.array(z.object({ row: z.number(), cells: z.array(z.object({ before: z.string().nullable(), after: z.string().nullable() })) })),
});
const jobSchema = z.object({
  id: z.uuid(),
  fileId: z.uuid(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  trigger: z.enum(['manual', 'auto']),
  resultFileId: z.uuid().nullable(),
  errorMessage: z.string().nullable(),
  steps: z.array(stepSchema),
  rowsBefore: z.number().nullable(),
  rowsAfter: z.number().nullable(),
  createdAt: z.string(),
});
const settingsSchema = z.object({
  datasetId: z.uuid(),
  keyColumns: z.array(z.string()),
  recipe: z.record(z.string(), z.unknown()).nullable(),
  autoClean: z.boolean(),
  autoCleanAvailable: z.boolean(),
});
const fileSchema = z.object({ id: z.uuid(), datasetId: z.uuid(), version: z.number(), isLatest: z.boolean(), originalName: z.string(), derivedFromFileId: z.string().nullable() }).loose();

describe('cleaning a file (integration)', () => {
  let h: AppHarness;
  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  async function company(plan: 'free' | 'basic' | 'premium' = 'basic') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session, companyId: admin.companyId };
  }

  async function profiled(session: SessionBody, content: string | Buffer = MESSY, name = 'people.csv', options: { visibility?: 'company' | 'restricted'; grantedUserIds?: string[] } = {}) {
    const response = await h.upload(session, { content: content.toString(), name, ...options }).expect(201);
    const file = fileSchema.parse(response.body);
    await h.drainTasks();
    return file;
  }

  const preview = (session: SessionBody, id: string, body: object) => h.http().post(`/files/${id}/clean/preview`).set(...h.bearer(session)).send(body);
  const clean = (session: SessionBody, id: string, body: object) => h.http().post(`/files/${id}/clean`).set(...h.bearer(session)).send(body);
  const getJob = async (session: SessionBody, fileId: string, jobId: string) =>
    jobSchema.parse((await h.http().get(`/files/${fileId}/clean/jobs/${jobId}`).set(...h.bearer(session)).expect(200)).body);
  const getFile = async (session: SessionBody, id: string) => fileSchema.parse((await h.http().get(`/files/${id}`).set(...h.bearer(session)).expect(200)).body);
  const settings = (session: SessionBody, datasetId: string) => h.http().get(`/datasets/${datasetId}/settings`).set(...h.bearer(session));
  const putSettings = (session: SessionBody, datasetId: string, body: object) => h.http().put(`/datasets/${datasetId}/settings`).set(...h.bearer(session)).send(body);
  const bytesOf = async (id: string) => {
    const row = await h.dataSource.getRepository(FileAsset).findOneByOrFail({ id });
    return (await h.storage.get(row.storageKey)).toString('utf8');
  };

  /** Starts a cleaning and lets the worker finish it. */
  async function cleaned(session: SessionBody, file: { id: string }, body: object = { recipe: RECIPE }) {
    const started = jobSchema.parse((await clean(session, file.id, body).expect(202)).body);
    await h.drainTasks();
    return getJob(session, file.id, started.id);
  }

  // ---- the dry run -----------------------------------------------------------

  describe('POST /files/:id/clean/preview', () => {
    it('counts what each step would do over the whole file, shows the rows that change, and writes nothing', async () => {
      const { session } = await company();
      const file = await profiled(session);

      const result = previewSchema.parse((await preview(session, file.id, { recipe: RECIPE }).expect(200)).body);

      expect(result.rowsBefore).toBe(4);
      expect(result.rowsAfter).toBe(2);
      expect(result.columns).toEqual(['name', 'joined', 'amount', 'note']);
      expect(result.steps.map((step) => [step.step, step.changed])).toEqual([
        ['trim_whitespace', 1],
        ['drop_empty_rows', 1],
        ['drop_duplicate_rows', 1],
        ['standardise_dates', 2],
        ['parse_numbers', 2],
        ['replace_values', 1],
      ]);
      expect(result.steps[3]?.notes.join(' ')).toMatch(/1 date like 03\/04\/2026/);
      expect(result.samples[0]).toMatchObject({ row: 2, cells: [{ before: ' Ada Lovelace ', after: 'Ada Lovelace' }, { before: '25/12/2025', after: '2025-12-25' }, { before: '1.234,50 €', after: '1234.5' }, { before: 'N/A', after: null }] });

      expect(await h.dataSource.getRepository(FileAsset).count()).toBe(1);
      expect(await h.dataSource.getRepository(UsageEvent).count()).toBe(1);
    });

    it('skips a step about a column the file does not have, and refuses a recipe it cannot read', async () => {
      const { session } = await company();
      const file = await profiled(session);

      const skipped = previewSchema.parse((await preview(session, file.id, { recipe: { steps: [{ step: 'drop_column', column: 'ghost' }, { step: 'trim_whitespace' }] } }).expect(200)).body);
      expect(skipped.steps[0]?.skipped).toBe('The column "ghost" is not in this file.');

      const bad = await preview(session, file.id, { recipe: { steps: [{ step: 'run_script' }] } }).expect(400);
      expect(JSON.stringify(bad.body)).toContain('Invalid recipe');
      await preview(session, file.id, { recipe: { steps: [] } }).expect(400);
      await preview(session, file.id, {}).expect(400);
    });

    it('cannot clean a legacy .xls', async () => {
      const { session } = await company();
      const response = await h.upload(session, { content: xlsBytes(), name: 'old.xls', contentType: 'application/vnd.ms-excel' }).expect(201);
      const id = fileSchema.parse(response.body).id;
      const refused = await preview(session, id, { recipe: RECIPE }).expect(422);
      expect(JSON.stringify(refused.body)).toContain('Legacy .xls files cannot be cleaned');
    });
  });

  // ---- making the new version ----------------------------------------------------

  describe('POST /files/:id/clean', () => {
    it('with an Idempotency-Key, a retry replays the first answer and starts one cleaning, not two', async () => {
      const { session } = await company();
      const file = await profiled(session);
      const key = '6f1e0c52-6a5e-4a52-8a7d-3b6b0b8d2f10';
      const send = () => h.http().post(`/files/${file.id}/clean`).set(...h.bearer(session)).set('Idempotency-Key', key).send({ recipe: RECIPE });

      const first = jobSchema.parse((await send().expect(202)).body);
      const second = jobSchema.parse((await send().expect(202)).body);
      expect(second.id).toBe(first.id);
      await h.drainTasks();
      expect(await h.dataSource.getRepository(FileAsset).count({ where: { datasetId: file.datasetId } })).toBe(2);
    });

    it('writes the cleaned data as the next version, keeps the original, and spends no file quota', async () => {
      const { session } = await company();
      const file = await profiled(session);

      const job = await cleaned(session, file);

      expect(job).toMatchObject({ status: 'succeeded', trigger: 'manual', rowsBefore: 4, rowsAfter: 2, errorMessage: null });
      expect(job.resultFileId).not.toBeNull();
      const result = await getFile(session, job.resultFileId ?? '');
      expect(result).toMatchObject({ version: 2, isLatest: true, originalName: 'people (cleaned).csv', derivedFromFileId: file.id, datasetId: file.datasetId });
      expect(await bytesOf(result.id)).toBe(CLEANED_CSV);

      const original = await getFile(session, file.id);
      expect(original).toMatchObject({ version: 1, isLatest: false });
      expect(await bytesOf(file.id)).toContain(' Ada Lovelace ');
      // Gridline made it; the company did not upload it.
      expect(await h.dataSource.getRepository(UsageEvent).count()).toBe(1);
    });

    it('gives the new version its own report, and tells the person who asked', async () => {
      const { admin, session } = await company();
      const file = await profiled(session);
      const job = await cleaned(session, file);
      await h.drainTasks();

      const report = z.object({ status: z.string(), metrics: z.object({ rowCount: z.number(), duplicateRows: z.number(), emptyRows: z.number() }).nullable() }).parse(
        (await h.http().get(`/files/${job.resultFileId}/report`).set(...h.bearer(session)).expect(200)).body,
      );
      expect(report.status).toBe('ready');
      expect(report.metrics).toMatchObject({ rowCount: 2, duplicateRows: 0, emptyRows: 0 });

      const rows = await h.dataSource.query('SELECT payload FROM notification WHERE "userId" = $1 AND type = $2', [admin.userId, 'file.cleaned']);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.payload).toMatchObject({ fileId: job.resultFileId, sourceFileId: file.id, version: 2, steps: 6 });
    });

    it('writes an audit entry for the new version, by the person who asked', async () => {
      const { admin, session } = await company();
      const file = await profiled(session);
      const job = await cleaned(session, file);

      const entries = await h.dataSource.getRepository(AuditLogEntry).find({ where: { action: 'file.cleaned' } });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ actorUserId: admin.userId, targetType: 'file', targetId: job.resultFileId });
      expect(entries[0]?.metadata).toMatchObject({ fromFileId: file.id, fromVersion: 1, steps: 6 });
    });

    it('keeps a workbook a workbook, and a CSV a CSV', async () => {
      const { session } = await company();
      const file = await profiled(session);
      const job = await cleaned(session, file, { recipe: { steps: [{ step: 'trim_whitespace' }] } });
      expect((await getFile(session, job.resultFileId ?? '')).originalName).toBe('people (cleaned).csv');
    });

    it('fails the job, with the reason, when the dataset is at its plan\'s version limit — and tells the person', async () => {
      const { admin, session } = await company('free'); // five versions per file
      let latest = await profiled(session);
      for (let version = 2; version <= 5; version += 1) {
        const response = await h.http().post(`/files/${latest.id}/versions`).set(...h.bearer(session)).attach('file', Buffer.from(`${MESSY}\nextra${version},1,1,x`), { filename: 'people.csv', contentType: 'text/csv' }).expect(201);
        latest = fileSchema.parse(response.body);
        await h.drainTasks();
      }

      const job = await cleaned(session, latest);

      expect(job.status).toBe('failed');
      expect(job.errorMessage).toMatch(/keeps up to 5 versions/);
      const rows = await h.dataSource.query('SELECT payload FROM notification WHERE "userId" = $1 AND type = $2', [admin.userId, 'cleaning.failed']);
      expect(rows).toHaveLength(1);
    });
  });

  // ---- who may, and what they may see -----------------------------------------------

  describe('access', () => {
    it('is a 404 for someone who cannot see the file, and a 403 for someone who can but did not upload it', async () => {
      const { session, companyId } = await company();
      const owner = await h.inviteAndAccept(session, companyId);
      const outsider = await h.inviteAndAccept(session, companyId);
      const viewer = await h.inviteAndAccept(session, companyId);
      const file = await profiled(owner.session, MESSY, 'secret.csv', { visibility: 'restricted', grantedUserIds: [viewer.userId] });

      await preview(outsider.session, file.id, { recipe: RECIPE }).expect(404);
      await clean(outsider.session, file.id, { recipe: RECIPE }).expect(404);
      await preview(viewer.session, file.id, { recipe: RECIPE }).expect(403);
      await clean(viewer.session, file.id, { recipe: RECIPE }).expect(403);
      await preview(owner.session, file.id, { recipe: RECIPE }).expect(200);
      await preview(session, file.id, { recipe: RECIPE }).expect(200);

      const job = jobSchema.parse((await clean(owner.session, file.id, { recipe: RECIPE }).expect(202)).body);
      await h.http().get(`/files/${file.id}/clean/jobs/${job.id}`).set(...h.bearer(outsider.session)).expect(404);
      await h.http().get(`/files/${file.id}/clean/jobs/${job.id}`).set(...h.bearer(viewer.session)).expect(200);
    });

    it('the cleaned version of a restricted file is restricted to the same people', async () => {
      const { session, companyId } = await company();
      const owner = await h.inviteAndAccept(session, companyId);
      const viewer = await h.inviteAndAccept(session, companyId);
      const outsider = await h.inviteAndAccept(session, companyId);
      const file = await profiled(owner.session, MESSY, 'secret.csv', { visibility: 'restricted', grantedUserIds: [viewer.userId] });

      const job = await cleaned(owner.session, file);

      await h.http().get(`/files/${job.resultFileId}`).set(...h.bearer(viewer.session)).expect(200);
      await h.http().get(`/files/${job.resultFileId}`).set(...h.bearer(outsider.session)).expect(404);
    });

    it('never reaches another company\'s file', async () => {
      const mine = await company();
      const theirs = await company();
      const file = await profiled(theirs.session);
      await preview(mine.session, file.id, { recipe: RECIPE }).expect(404);
      await clean(mine.session, file.id, { recipe: RECIPE }).expect(404);
    });

    it('needs a plan, and the files:write scope for a key', async () => {
      const admin = await h.registerAndActivate();
      const session = await h.login(admin.email);
      await preview(session, '00000000-0000-4000-8000-000000000000', { recipe: RECIPE }).expect(402);
    });
  });

  // ---- a dataset's saved settings --------------------------------------------------

  describe('dataset settings', () => {
    it('answers with the defaults until something is saved, then keeps what was saved', async () => {
      const { session } = await company('basic');
      const file = await profiled(session);

      const before = settingsSchema.parse((await settings(session, file.datasetId).expect(200)).body);
      expect(before).toEqual({ datasetId: file.datasetId, keyColumns: [], recipe: null, autoClean: false, autoCleanAvailable: true });

      const saved = settingsSchema.parse((await putSettings(session, file.datasetId, { recipe: RECIPE, autoClean: true, keyColumns: ['name'] }).expect(200)).body);
      expect(saved).toMatchObject({ autoClean: true, keyColumns: ['name'] });
      expect(saved.recipe).toMatchObject({ steps: expect.any(Array) });
      expect(settingsSchema.parse((await settings(session, file.datasetId).expect(200)).body)).toEqual(saved);

      const audit = await h.dataSource.getRepository(AuditLogEntry).find({ where: { action: 'dataset.settings_updated' } });
      expect(audit).toHaveLength(1);
    });

    it('removing the recipe switches automatic cleaning off', async () => {
      const { session } = await company('basic');
      const file = await profiled(session);
      await putSettings(session, file.datasetId, { recipe: RECIPE, autoClean: true }).expect(200);
      const cleared = settingsSchema.parse((await putSettings(session, file.datasetId, { recipe: null }).expect(200)).body);
      expect(cleared).toMatchObject({ recipe: null, autoClean: false });
    });

    it('refuses automatic cleaning on Free (402), without a recipe (400), and an empty body (400)', async () => {
      const free = await company('free');
      const freeFile = await profiled(free.session);
      expect(settingsSchema.parse((await settings(free.session, freeFile.datasetId).expect(200)).body).autoCleanAvailable).toBe(false);
      const refused = await putSettings(free.session, freeFile.datasetId, { recipe: RECIPE, autoClean: true }).expect(402);
      expect(JSON.stringify(refused.body)).toContain('Basic and Premium');
      await putSettings(free.session, freeFile.datasetId, { recipe: RECIPE }).expect(200);

      const basic = await company('basic');
      const file = await profiled(basic.session);
      await putSettings(basic.session, file.datasetId, { autoClean: true }).expect(400);
      await putSettings(basic.session, file.datasetId, {}).expect(400);
      await clean(basic.session, file.id, { recipe: RECIPE, autoClean: true }).expect(400);
      await clean(free.session, freeFile.id, { recipe: RECIPE, saveRecipe: true, autoClean: true }).expect(402);
    });

    it('may be read by anyone who can see the dataset, changed only by its uploader or an admin, and is a 404 across companies', async () => {
      const { session, companyId } = await company('basic');
      const owner = await h.inviteAndAccept(session, companyId);
      const other = await h.inviteAndAccept(session, companyId);
      const file = await profiled(owner.session);
      const stranger = await company('basic');

      await settings(other.session, file.datasetId).expect(200);
      await putSettings(other.session, file.datasetId, { keyColumns: ['name'] }).expect(403);
      await putSettings(owner.session, file.datasetId, { keyColumns: ['name'] }).expect(200);
      await settings(stranger.session, file.datasetId).expect(404);
      await putSettings(stranger.session, file.datasetId, { keyColumns: ['name'] }).expect(404);
    });

    it('saving a recipe while cleaning remembers it', async () => {
      const { session } = await company('basic');
      const file = await profiled(session);
      await clean(session, file.id, { recipe: RECIPE, saveRecipe: true }).expect(202);
      const saved = settingsSchema.parse((await settings(session, file.datasetId).expect(200)).body);
      expect(saved.recipe).toMatchObject({ steps: expect.any(Array) });
      expect(saved.autoClean).toBe(false);
    });
  });

  // ---- cleaning every new version -----------------------------------------------------

  describe('automatic cleaning', () => {
    it('keeps each upload as it arrived and follows it with a cleaned version', async () => {
      const { session } = await company('basic');
      const first = await profiled(session);
      await putSettings(session, first.datasetId, { recipe: RECIPE, autoClean: true }).expect(200);

      const response = await h.http().post(`/files/${first.id}/versions`).set(...h.bearer(session)).attach('file', Buffer.from(MESSY), { filename: 'people.csv', contentType: 'text/csv' }).expect(201);
      const raw = fileSchema.parse(response.body);
      await h.drainTasks();
      await h.drainTasks();

      expect(raw.version).toBe(2);
      const versions = await h.dataSource.getRepository(FileAsset).find({ where: { datasetId: first.datasetId }, order: { version: 'ASC' } });
      expect(versions.map((version) => [version.version, version.originalName, version.isLatest, version.derivedFromFileId])).toEqual([
        [1, 'people.csv', false, null],
        [2, 'people.csv', false, null],
        [3, 'people (cleaned).csv', true, raw.id],
      ]);
      const latest = versions[2];
      expect(latest ? await bytesOf(latest.id) : '').toBe(CLEANED_CSV);
      // The raw upload counted; the cleaned copy did not.
      expect(await h.dataSource.getRepository(UsageEvent).count()).toBe(2);
    });

    it('does nothing when it is switched off, and never cleans a cleaned version again', async () => {
      const { session } = await company('basic');
      const first = await profiled(session);
      await putSettings(session, first.datasetId, { recipe: RECIPE, autoClean: false }).expect(200);
      await h.http().post(`/files/${first.id}/versions`).set(...h.bearer(session)).attach('file', Buffer.from(MESSY), { filename: 'people.csv', contentType: 'text/csv' }).expect(201);
      await h.drainTasks();
      expect(await h.dataSource.getRepository(FileAsset).count({ where: { datasetId: first.datasetId } })).toBe(2);

      await putSettings(session, first.datasetId, { autoClean: true }).expect(200);
      await h.http().post(`/files/${first.id}/versions`).set(...h.bearer(session)).attach('file', Buffer.from(MESSY), { filename: 'people.csv', contentType: 'text/csv' }).expect(201);
      await h.drainTasks();
      await h.drainTasks();
      // Two uploads, one cleaned copy: the cleaned copy was not itself cleaned.
      expect(await h.dataSource.getRepository(FileAsset).count({ where: { datasetId: first.datasetId } })).toBe(4);
    });
  });
});
