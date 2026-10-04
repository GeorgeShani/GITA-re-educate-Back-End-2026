import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { AskEvent } from './ask-event.entity.js';

const SALES = ['region,product,revenue', 'North,A,100', 'North,B,250.5', 'South,A,40', 'South,B,n/a', ''].join('\n');

const fileSchema = z.object({ id: z.uuid() }).loose();
const resultSchema = z.object({
  columns: z.array(z.object({ name: z.string(), kind: z.enum(['group', 'measure']) })),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
  rowsMatched: z.number(),
  rowsScanned: z.number(),
  groupCount: z.number(),
  notes: z.array(z.string()),
});
const askSchema = z.object({
  question: z.string(),
  spec: z.record(z.string(), z.unknown()),
  result: resultSchema,
  model: z.string().nullable(),
  questionsUsed: z.number(),
  questionsLimit: z.number(),
});
const allowanceSchema = z.object({ aiAvailable: z.boolean(), questionsUsed: z.number(), questionsLimit: z.number() });

const BY_REGION = { groupBy: ['region'], measures: [{ fn: 'sum', column: 'revenue' }], sort: { by: 'measure', index: 0, direction: 'desc' } };

describe('explore and ask (integration)', () => {
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

  async function profiled(session: SessionBody, options: { visibility?: 'company' | 'restricted'; grantedUserIds?: string[] } = {}) {
    const file = fileSchema.parse((await h.upload(session, { content: SALES, name: 'sales.csv', ...options }).expect(201)).body);
    await h.drainTasks();
    return file;
  }

  const explore = (session: SessionBody, id: string, query: object) => h.http().post(`/files/${id}/explore`).set(...h.bearer(session)).send({ query });
  const ask = (session: SessionBody, id: string, question = 'Revenue by region') => h.http().post(`/files/${id}/ask`).set(...h.bearer(session)).send({ question });

  describe('POST /files/:id/explore', () => {
    it('groups and totals every row, and says what it left out', async () => {
      const { session } = await company();
      const file = await profiled(session);
      const result = resultSchema.parse((await explore(session, file.id, BY_REGION).expect(200)).body);
      expect(result.columns.map((column) => column.name)).toEqual(['region', 'Sum of revenue']);
      expect(result.rows).toEqual([['North', 350.5], ['South', 40]]);
      expect(result).toMatchObject({ rowsMatched: 4, rowsScanned: 4, groupCount: 2 });
      expect(result.notes).toEqual(['1 cell in "revenue" were not numbers and were left out.']);
    });

    it('is free: it never touches the plan’s questions', async () => {
      const { session } = await company('free');
      const file = await profiled(session);
      for (let i = 0; i < 25; i += 1) await explore(session, file.id, { measures: [{ fn: 'count' }] }).expect(200);
      expect(await h.dataSource.getRepository(AskEvent).count()).toBe(0);
    });

    it('refuses a query that is not valid and a column the file does not have, and writes nothing', async () => {
      const { session } = await company();
      const file = await profiled(session);
      await explore(session, file.id, { measures: [{ fn: 'sum' }] }).expect(400);
      await explore(session, file.id, { groupBy: ['a', 'b', 'c'] }).expect(400);
      const unknown = await explore(session, file.id, { groupBy: ['country'] }).expect(422);
      expect(unknown.body).toMatchObject({ message: 'This file has no column "country".' });
      await explore(session, file.id, { measures: [{ fn: 'sum', column: 'product' }] }).expect(422);
    });

    it('is a 404 for someone who cannot see the file, in another company or without a grant', async () => {
      const { session, companyId } = await company();
      const employee = await h.inviteAndAccept(session, companyId);
      const file = await profiled(session, { visibility: 'restricted', grantedUserIds: [] });
      await explore(employee.session, file.id, { measures: [{ fn: 'count' }] }).expect(404);
      await ask(employee.session, file.id).expect(404);

      const stranger = await h.registerAndActivate();
      const strangerSession = await h.login(stranger.email);
      await h.subscribe(strangerSession, 'basic');
      await explore(strangerSession, file.id, { measures: [{ fn: 'count' }] }).expect(404);
    });

    it('waits for the report: a file that is still being profiled is a 409', async () => {
      const { session } = await company();
      const file = fileSchema.parse((await h.upload(session, { content: SALES, name: 'sales.csv' }).expect(201)).body);
      await explore(session, file.id, { measures: [{ fn: 'count' }] }).expect(409);
    });
  });

  describe('POST /files/:id/ask', () => {
    it('shows the assistant only the question and the columns’ names and types, then runs what it planned', async () => {
      const { session } = await company();
      const file = await profiled(session);
      h.ai.nextPlan({ ok: true, spec: { filters: [], groupBy: ['region'], measures: [{ fn: 'sum', column: 'revenue' }], sort: { by: 'measure', index: 0, direction: 'desc' }, limit: 50 } });

      const answer = askSchema.parse((await ask(session, file.id, 'Revenue by region').expect(200)).body);

      expect(answer.result.rows).toEqual([['North', 350.5], ['South', 40]]);
      expect(answer).toMatchObject({ question: 'Revenue by region', model: 'fake-model', questionsUsed: 1, questionsLimit: 300 });
      expect(h.ai.planCalls).toEqual([{ question: 'Revenue by region', columns: [{ name: 'region', type: 'string' }, { name: 'product', type: 'string' }, { name: 'revenue', type: 'number' }] }]);
      // Not one cell of the file reached the model.
      const shown = JSON.stringify(h.ai.planCalls);
      for (const value of ['North', 'South', '250.5', 'n/a']) expect(shown).not.toContain(value);
      expect(await h.dataSource.getRepository(AskEvent).count()).toBe(1);
    });

    it('runs a plan the model got wrong as an error, not a crash, and still counts the question it spent', async () => {
      const { session } = await company();
      const file = await profiled(session);
      h.ai.nextPlan({ ok: true, spec: { filters: [], groupBy: ['country'], measures: [{ fn: 'count' }], limit: 50 } });
      const failed = await ask(session, file.id).expect(422);
      expect(failed.body).toMatchObject({ message: 'This file has no column "country".' });
      expect(await h.dataSource.getRepository(AskEvent).count()).toBe(1);
    });

    it('costs nothing when the assistant has no answer, declines, or is switched off', async () => {
      const { session } = await company();
      const file = await profiled(session);

      h.ai.nextPlan(null);
      await ask(session, file.id).expect(503);
      h.ai.nextPlan({ ok: false, reason: 'There is no column about weather.' });
      const declined = await ask(session, file.id, 'Will it rain?').expect(422);
      expect(declined.body).toMatchObject({ message: 'The assistant could not answer that from this file: There is no column about weather.' });
      expect(await h.dataSource.getRepository(AskEvent).count()).toBe(0);

      const saved = h.ai.name;
      Object.assign(h.ai, { name: 'off' });
      try {
        const off = await ask(session, file.id).expect(503);
        expect(off.body).toMatchObject({ message: expect.stringContaining('switched off') });
        expect(allowanceSchema.parse((await h.http().get(`/files/${file.id}/ask/allowance`).set(...h.bearer(session)).expect(200)).body).aiAvailable).toBe(false);
      } finally {
        Object.assign(h.ai, { name: saved });
      }
    });

    it('stops at the plan’s limit with a 402 that points to the free query builder, and starts again next period', async () => {
      const { session, companyId } = await company('free');
      const file = await profiled(session);
      for (let i = 0; i < 20; i += 1) {
        h.ai.nextPlan({ ok: true, spec: { filters: [], groupBy: [], measures: [{ fn: 'count' }], limit: 50 } });
        await ask(session, file.id).expect(200);
      }
      const refused = await ask(session, file.id).expect(402);
      expect(refused.body).toMatchObject({ message: expect.stringContaining('answers 20 questions') });
      expect(h.ai.planCalls).toHaveLength(20);
      expect(allowanceSchema.parse((await h.http().get(`/files/${file.id}/ask/allowance`).set(...h.bearer(session)).expect(200)).body)).toEqual({ aiAvailable: true, questionsUsed: 20, questionsLimit: 20 });
      await explore(session, file.id, { measures: [{ fn: 'count' }] }).expect(200);

      // The period ends: the new one has none used.
      await h.dataSource.getRepository(AskEvent).update({ companyId }, { createdAt: new Date('2000-01-01T00:00:00Z') });
      h.ai.nextPlan({ ok: true, spec: { filters: [], groupBy: [], measures: [{ fn: 'count' }], limit: 50 } });
      await ask(session, file.id).expect(200);
    });
  });
});
