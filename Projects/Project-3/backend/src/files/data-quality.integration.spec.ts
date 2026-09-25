import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { FakeAiProvider } from '#test/support/fake-ai.js';
import { realXlsxBytes, xlsBytes, xlsxBytes } from '#test/support/spreadsheet-fixtures.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { DataQualityReport } from './data-quality-report.entity.js';
import { MAX_UNCOMPRESSED_XLSX_BYTES } from './parsing/spreadsheet-reader.js';

const columnSchema = z
  .object({
    index: z.number(),
    name: z.string(),
    nullCount: z.number(),
    nullPercent: z.number(),
    inferredType: z.enum(['integer', 'number', 'boolean', 'date', 'string', 'empty']),
    typeCounts: z.object({ integer: z.number(), number: z.number(), boolean: z.number(), date: z.number(), string: z.number() }).strict(),
    inconsistent: z.boolean(),
    inconsistentPercent: z.number(),
    numeric: z.object({ min: z.number(), max: z.number(), mean: z.number() }).strict().nullable(),
  })
  .strict();
const metricsSchema = z
  .object({
    rowCount: z.number(),
    columnCount: z.number(),
    emptyRows: z.number(),
    duplicateRows: z.number(),
    raggedRows: z.number(),
    truncated: z.boolean(),
    rowBudget: z.number(),
    headerIssues: z.array(z.string()),
    columns: z.array(columnSchema),
  })
  .strict();
const reportSchema = z
  .object({
    fileId: z.uuid(),
    status: z.enum(['queued', 'profiling', 'ready', 'unsupported', 'failed']),
    metrics: metricsSchema.nullable(),
    narrative: z.object({ summary: z.string(), recommendations: z.array(z.string()), model: z.string() }).strict().nullable(),
    errorMessage: z.string().nullable(),
    profiledAt: z.string().nullable(),
  })
  .strict();
const previewSchema = z
  .object({
    columns: z.array(z.object({ name: z.string(), inferredType: z.string() }).strict()),
    rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
    totalRows: z.number(),
    truncated: z.boolean(),
  })
  .strict();
const fileIdSchema = z.object({ id: z.uuid() });

const PEOPLE_CSV = [
  'name,age,city,active,joined',
  'Ada,36,London,true,2020-01-02',
  'Grace,,Arlington,false,2019-05-06',
  'Grace,,Arlington,false,2019-05-06',
  'Alan,forty,London,true,2021-03-04',
  '',
].join('\n');

describe('data-quality reports and preview (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  // ---- helpers ------------------------------------------------------------

  async function company(plan: 'basic' | 'premium' = 'basic') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session, companyId: admin.companyId };
  }

  async function upload(session: SessionBody, options: Parameters<AppHarness['upload']>[1] = {}): Promise<string> {
    const response = await h.upload(session, options).expect(201);
    return fileIdSchema.parse(response.body).id;
  }

  const getReport = (session: SessionBody, id: string) => h.http().get(`/files/${id}/report`).set(...h.bearer(session));
  const getPreview = (session: SessionBody, id: string) => h.http().get(`/files/${id}/preview`).set(...h.bearer(session));
  const report = async (session: SessionBody, id: string) => reportSchema.parse((await getReport(session, id).expect(200)).body);
  const preview = async (session: SessionBody, id: string) => previewSchema.parse((await getPreview(session, id).expect(200)).body);
  const task = (fileId: string) =>
    h.dataSource
      .getRepository(BackgroundTask)
      .createQueryBuilder('t')
      .where("t.type = 'build_data_quality_report' AND t.payload ->> 'fileId' = :fileId", { fileId })
      .getOneOrFail();

  /** Upload a profiled CSV and let the worker run. */
  async function profiled(session: SessionBody, content: string | Buffer = PEOPLE_CSV, name = 'people.csv') {
    const id = await upload(session, { content, name });
    await h.drainTasks();
    return id;
  }

  // ---- the lifecycle -------------------------------------------------------

  describe('a report exists from the moment the file does', () => {
    it('is `queued` straight after upload, with nothing in it yet', async () => {
      const { session } = await company();
      const id = await upload(session);

      expect(await report(session, id)).toEqual({
        fileId: id,
        status: 'queued',
        metrics: null,
        narrative: null,
        errorMessage: null,
        profiledAt: null,
      });
    });

    it('the preview is a 409 until profiling has finished', async () => {
      const { session } = await company();
      const id = await upload(session);

      const response = await getPreview(session, id).expect(409);
      expect(response.body.message).toMatch(/still being prepared/);
    });

    it('becomes `ready` once the task has run', async () => {
      const { session } = await company();
      const id = await profiled(session);

      const ready = await report(session, id);
      expect(ready.status).toBe('ready');
      expect(ready.profiledAt).toBe('2026-03-01T12:00:00.000Z');
      expect((await task(id)).status).toBe('succeeded');
    });

    it('a file is profiled once: re-running the task leaves a finished report alone', async () => {
      const { session, companyId } = await company();
      const id = await profiled(session);
      const before = await report(session, id);

      await h.app.get(TaskQueue).enqueue('build_data_quality_report', { fileId: id, companyId });
      await h.drainTasks();

      expect(await report(session, id)).toEqual(before);
      expect(h.ai.calls).toHaveLength(1);
    });
  });

  // ---- the metrics --------------------------------------------------------

  describe('metrics', () => {
    it('describes a CSV: counts, nulls, types, inconsistency and duplicates', async () => {
      const { session } = await company();
      const { metrics } = await report(session, await profiled(session));

      expect(metrics).toMatchObject({
        rowCount: 4,
        columnCount: 5,
        duplicateRows: 1,
        emptyRows: 0,
        raggedRows: 0,
        truncated: false,
        headerIssues: [],
      });
      const byName = Object.fromEntries((metrics?.columns ?? []).map((column) => [column.name, column]));
      expect(byName.name).toMatchObject({ inferredType: 'string', nullCount: 0, inconsistent: false });
      expect(byName.city).toMatchObject({ inferredType: 'string', nullCount: 0 });
      expect(byName.active).toMatchObject({ inferredType: 'boolean', inconsistent: false });
      expect(byName.joined).toMatchObject({ inferredType: 'date', inconsistent: false });
      // age: '36', '', '', 'forty' — half empty, and the two values disagree about what the column is.
      expect(byName.age).toMatchObject({
        inferredType: 'integer',
        nullCount: 2,
        nullPercent: 50,
        inconsistent: true,
        inconsistentPercent: 50,
        numeric: { min: 36, max: 36, mean: 36 },
      });
    });

    it('describes a REAL xlsx workbook: dates stay dates, numbers stay numbers', async () => {
      const { session } = await company();
      const bytes = await realXlsxBytes([
        ['id', 'amount', 'when', 'paid'],
        [1, 10.5, new Date('2026-01-02T00:00:00Z'), true],
        [2, 20, new Date('2026-02-03T00:00:00Z'), false],
        [3, null, new Date('2026-03-04T00:00:00Z'), true],
      ]);

      const { metrics } = await report(session, await profiled(session, bytes, 'book.xlsx'));

      expect(metrics?.rowCount).toBe(3);
      expect(metrics?.columns.map((c) => [c.name, c.inferredType])).toEqual([
        ['id', 'integer'],
        ['amount', 'number'],
        ['when', 'date'],
        ['paid', 'boolean'],
      ]);
      expect(metrics?.columns[1]).toMatchObject({ nullCount: 1, numeric: { min: 10.5, max: 20, mean: 15.25 } });
    });

    it('reports header problems instead of guessing', async () => {
      const { session } = await company();
      const { metrics } = await report(session, await profiled(session, 'id,,id\n1,2,3\n'));

      expect(metrics?.columns.map((column) => column.name)).toEqual(['id', 'column_2', 'id_2']);
      expect(metrics?.headerIssues).toHaveLength(2);
    });

    it('counts ragged and empty rows', async () => {
      const { session } = await company();
      const bytes = await realXlsxBytes([['a', 'b'], [1, 2], [null, null], [3]]);
      const { metrics } = await report(session, await profiled(session, bytes, 'gaps.xlsx'));

      expect(metrics).toMatchObject({ rowCount: 3, emptyRows: 1 });
    });

    it('a header-only file is ready with zero rows', async () => {
      const { session } = await company();
      const ready = await report(session, await profiled(session, 'a,b\n'));

      expect(ready.status).toBe('ready');
      expect(ready.metrics).toMatchObject({ rowCount: 0, columnCount: 2 });
    });
  });

  // ---- the narrative -------------------------------------------------------

  describe('the AI narrative', () => {
    it('is attached, with the model that wrote it', async () => {
      const { session } = await company();
      const ready = await report(session, await profiled(session));

      expect(ready.narrative).toEqual({
        summary: FakeAiProvider.DEFAULT.summary,
        recommendations: FakeAiProvider.DEFAULT.recommendations,
        model: 'fake-model',
      });
    });

    it('without one (AI off, a timeout, malformed output) the metrics still ship', async () => {
      const { session } = await company();
      h.ai.next(null);

      const ready = await report(session, await profiled(session));

      expect(ready.status).toBe('ready');
      expect(ready.narrative).toBeNull();
      expect(ready.metrics?.rowCount).toBe(4);
    });

    it('is shown aggregates only — never a cell value', async () => {
      const { session } = await company();
      await profiled(session, 'name,salary\nCONFIDENTIAL-PERSON-NAME,123456\nAnother-Secret,654321\n');

      const shown = JSON.stringify(h.ai.calls);
      expect(shown).not.toContain('CONFIDENTIAL-PERSON-NAME');
      expect(shown).not.toContain('Another-Secret');
      // Not even the extremes of a numeric column (min and max are cell values); its mean is fine.
      expect(shown).not.toContain('123456');
      expect(shown).not.toContain('654321');
      expect(shown).toContain('388888.5');
      // …but it does see the shape of the data.
      expect(shown).toContain('"name":"salary"');
      expect(h.ai.calls[0]).toMatchObject({ rowCount: 2, columnCount: 2 });
    });

    it('is not asked for at all when there is nothing to profile', async () => {
      const { session } = await company();
      await profiled(session, xlsBytes(), 'old.xls');

      expect(h.ai.calls).toHaveLength(0);
    });
  });

  // ---- formats and failure -------------------------------------------------

  describe('files that cannot be profiled', () => {
    it('legacy .xls is stored and listed but reported as unsupported — and the task succeeds', async () => {
      const { session } = await company();
      const id = await profiled(session, xlsBytes(), 'old.xls');

      const result = await report(session, id);
      expect(result).toMatchObject({ status: 'unsupported', metrics: null, narrative: null });
      expect(result.errorMessage).toMatch(/\.xlsx or \.csv/);
      expect((await task(id)).status).toBe('succeeded');
      await h.http().get(`/files/${id}`).set(...h.bearer(session)).expect(200);
    });

    it('the preview of an unsupported file is a 422 that says why', async () => {
      const { session } = await company();
      const id = await profiled(session, xlsBytes(), 'old.xls');

      const response = await getPreview(session, id).expect(422);
      expect(response.body.message).toMatch(/\.xlsx or \.csv/);
    });

    it('a corrupt workbook is `failed` with the reason — and is NOT retried', async () => {
      const { session } = await company();
      // Passes the upload check (a ZIP declaring itself a spreadsheet) but holds no workbook.
      const id = await profiled(session, xlsxBytes(), 'broken.xlsx');

      const result = await report(session, id);
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toMatch(/could not be read as \.xlsx/);
      const done = await task(id);
      expect(done).toMatchObject({ status: 'succeeded', attempts: 0 });
    });

    it('a CSV whose unclosed quote is past the upload check’s sample is `failed` with the parser’s reason', async () => {
      const { session } = await company();
      // The upload check reads the first 64 KB; the fault is after it, so the file is accepted.
      const csv = 'a,b\n' + 'x,y\n'.repeat(20_000) + '1,"never closed\n2,3\n';
      const id = await profiled(session, csv);

      const result = await report(session, id);
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toMatch(/Quote Not Closed/);
    });

    it('a zip bomb is refused without being inflated', async () => {
      const { session } = await company();
      const bomb = await realXlsxBytes([['a'], [1]]);
      const end = bomb.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
      bomb.writeUInt32LE(MAX_UNCOMPRESSED_XLSX_BYTES + 1, bomb.readUInt32LE(end + 16) + 24);

      const result = await report(session, await profiled(session, bomb, 'bomb.xlsx'));

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toMatch(/more data than can be profiled safely/);
    });

    it('a failed preview is a 422 with the reason', async () => {
      const { session } = await company();
      const id = await profiled(session, xlsxBytes(), 'broken.xlsx');

      await getPreview(session, id).expect(422);
    });
  });

  describe('transient problems are retried by the task queue', () => {
    it('a storage hiccup fails the attempt, then the retry succeeds', async () => {
      const { session } = await company();
      const id = await upload(session);
      vi.spyOn(h.storage, 'get').mockRejectedValueOnce(new Error('S3 timed out'));

      await h.drainTasks();
      // Between attempts the report says so, rather than claiming to be profiling.
      expect(await report(session, id)).toMatchObject({ status: 'failed', errorMessage: expect.stringMatching(/retried/) });
      expect(await task(id)).toMatchObject({ status: 'pending', attempts: 1 });

      h.clock.advance(3 * 60_000);
      await h.drainTasks();

      expect(await report(session, id)).toMatchObject({ status: 'ready', errorMessage: null });
      expect((await task(id)).status).toBe('succeeded');
    });

    it('if every retry fails the task is dead and the report honestly stays failed', async () => {
      const { session, admin } = await company();
      const id = await upload(session);
      vi.spyOn(h.storage, 'get').mockRejectedValue(new Error('S3 is down'));

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await h.drainTasks();
        h.clock.advance(3 * 3_600_000);
      }
      vi.restoreAllMocks();

      expect((await task(id)).status).toBe('dead');
      // Hours have passed on the fake clock, so sign in afresh to read it.
      expect((await report(await h.login(admin.email), id)).status).toBe('failed');
    });
  });

  describe('the worker takes its scope from the task, not from trust', () => {
    it('skips a file deleted before the worker got to it', async () => {
      const { session } = await company();
      const id = await upload(session);
      await h.http().delete(`/files/${id}`).set(...h.bearer(session)).expect(200);

      await h.drainTasks();

      expect((await task(id)).status).toBe('succeeded');
      expect((await h.dataSource.getRepository(DataQualityReport).findOneByOrFail({ fileId: id })).status).toBe('queued');
      expect(h.ai.calls).toHaveLength(0);
    });

    it('does nothing for a task naming another company’s file', async () => {
      const mine = await company();
      const other = await company();
      const id = await upload(mine.session);
      // Drop the real task, then queue one that claims the file belongs to someone else.
      await h.dataSource.getRepository(BackgroundTask).clear();
      await h.app.get(TaskQueue).enqueue('build_data_quality_report', { fileId: id, companyId: other.companyId });

      await h.drainTasks();

      expect((await report(mine.session, id)).status).toBe('queued');
      expect(h.ai.calls).toHaveLength(0);
      // It was SKIPPED (a clean success), not attempted and failed: the file simply is not
      // in the company the task names.
      expect(await h.dataSource.getRepository(BackgroundTask).findOneByOrFail({})).toMatchObject({
        status: 'succeeded',
        attempts: 0,
      });
    });

    it('a malformed task payload is rejected, not run', async () => {
      await h.app.get(TaskQueue).enqueue('build_data_quality_report', { fileId: 'nope' });
      await h.drainTasks();
      for (let attempt = 0; attempt < 6; attempt += 1) {
        h.clock.advance(3_600_000 * 3);
        await h.drainTasks();
      }

      const [row] = await h.dataSource.getRepository(BackgroundTask).find();
      expect(row?.status).toBe('dead');
    });
  });

  // ---- the preview --------------------------------------------------------

  describe('GET /files/:id/preview', () => {
    it('returns the first rows and the inferred column types', async () => {
      const { session } = await company();
      const shown = await preview(session, await profiled(session));

      expect(shown.columns).toEqual([
        { name: 'name', inferredType: 'string' },
        { name: 'age', inferredType: 'integer' },
        { name: 'city', inferredType: 'string' },
        { name: 'active', inferredType: 'boolean' },
        { name: 'joined', inferredType: 'date' },
      ]);
      expect(shown.rows).toHaveLength(4);
      expect(shown.rows[0]).toEqual(['Ada', '36', 'London', 'true', '2020-01-02']);
      expect(shown).toMatchObject({ totalRows: 4, truncated: false });
    });

    it('shows only the first 50 rows of a longer file, and says there are more', async () => {
      const { session } = await company();
      const csv = 'n\n' + Array.from({ length: 120 }, (_, i) => String(i)).join('\n') + '\n';
      const shown = await preview(session, await profiled(session, csv));

      expect(shown.rows).toHaveLength(50);
      expect(shown.rows[49]).toEqual(['49']);
      expect(shown).toMatchObject({ totalRows: 120, truncated: true });
    });

    it('exactly 50 rows is not truncated', async () => {
      const { session } = await company();
      const csv = 'n\n' + Array.from({ length: 50 }, (_, i) => String(i)).join('\n') + '\n';

      expect(await preview(session, await profiled(session, csv))).toMatchObject({ totalRows: 50, truncated: false });
    });

    it('turns workbook dates into ISO strings and keeps numbers as numbers', async () => {
      const { session } = await company();
      const bytes = await realXlsxBytes([['when', 'n', 'ok'], [new Date('2026-01-02T00:00:00Z'), 1.5, true]]);

      const shown = await preview(session, await profiled(session, bytes, 'book.xlsx'));

      expect(shown.rows).toEqual([['2026-01-02T00:00:00.000Z', 1.5, true]]);
    });

    it('cuts very long cells, so a preview stays a preview', async () => {
      const { session } = await company();
      const shown = await preview(session, await profiled(session, `t\n${'x'.repeat(5_000)}\n`));

      expect(String(shown.rows[0]?.[0]).length).toBe(200);
    });

    it('is served from what profiling stored: it reads no file', async () => {
      const { session } = await company();
      const id = await profiled(session);
      const read = vi.spyOn(h.storage, 'get');

      await preview(session, id);
      await report(session, id);

      expect(read).not.toHaveBeenCalled();
    });
  });

  // ---- who may see them ----------------------------------------------------

  describe('visibility: a report and preview are exactly as visible as their file', () => {
    async function team() {
      const base = await company('basic');
      const member = async () => {
        const e = await h.inviteAndAccept(base.session, base.companyId);
        return { userId: e.userId, session: e.session };
      };
      return { ...base, a: await member(), b: await member(), c: await member() };
    }

    it('a restricted file: the grantee, uploader and admin see it; a colleague gets 404 on both', async () => {
      const t = await team();
      const id = await upload(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId] });
      await h.drainTasks();

      for (const viewer of [t.a.session, t.b.session, t.session]) {
        expect((await report(viewer, id)).status).toBe('ready');
        await getPreview(viewer, id).expect(200);
      }
      await getReport(t.c.session, id).expect(404);
      await getPreview(t.c.session, id).expect(404);
    });

    it('revoking access closes it at once', async () => {
      const t = await team();
      const id = await upload(t.a.session, { visibility: 'restricted', grantedUserIds: [t.b.userId] });
      await h.drainTasks();
      await getReport(t.b.session, id).expect(200);

      await h.http().patch(`/files/${id}`).set(...h.bearer(t.a.session)).send({ grantedUserIds: [] }).expect(200);

      await getReport(t.b.session, id).expect(404);
      await getPreview(t.b.session, id).expect(404);
    });

    it('never crosses companies', async () => {
      const mine = await company();
      const other = await company();
      const id = await profiled(mine.session);

      await getReport(other.session, id).expect(404);
      await getPreview(other.session, id).expect(404);
    });

    it('a deleted file has no report or preview', async () => {
      const { session } = await company();
      const id = await profiled(session);
      await h.http().delete(`/files/${id}`).set(...h.bearer(session)).expect(200);

      await getReport(session, id).expect(404);
      await getPreview(session, id).expect(404);
    });

    it('a malformed id is 400 and an unknown one 404; both need a signed-in user and a plan', async () => {
      const { session } = await company();
      await getReport(session, 'nope').expect(400);
      await getReport(session, randomUUID()).expect(404);
      await getPreview(session, randomUUID()).expect(404);
      await h.http().get(`/files/${randomUUID()}/report`).expect(401);
      await h.http().get(`/files/${randomUUID()}/preview`).expect(401);
    });

    it('a file with no report row (predates reports) is a clean 404, not a crash', async () => {
      const { session } = await company();
      const id = await upload(session);
      await h.dataSource.getRepository(DataQualityReport).delete({ fileId: id });

      await getReport(session, id).expect(404);
    });
  });
});
