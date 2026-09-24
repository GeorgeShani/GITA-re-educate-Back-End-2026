import { AsyncLocalStorage } from 'node:async_hooks';
import { ClsService } from 'nestjs-cls';
import { PinoLogger } from 'nestjs-pino';
import type { Repository } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FakeClock } from '#test/support/fake-clock.js';
import { PostgresTestContext } from '#test/support/postgres-context.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { MAX_TASK_ATTEMPTS, computeBackoffMs } from './backoff.js';
import { BackgroundTask } from './background-task.entity.js';
import type { TaskHandler } from './task-handler.js';
import { TaskQueue } from './task-queue.service.js';
import { TaskRunner } from './task-runner.service.js';

interface TestPayload {
  n: number;
}

const payloadSchema = z.object({ n: z.number() });

describe('background task queue (integration)', () => {
  let ctx: PostgresTestContext;
  let repository: Repository<BackgroundTask>;
  let clock: FakeClock;
  let cls: ClsService;
  let context: RequestContextService;
  let queue: TaskQueue;

  /** `send_email` is the only registered type today; the handler is a stand-in. */
  function handler(handle: (payload: TestPayload) => Promise<void>): TaskHandler<TestPayload> {
    return { type: 'send_email', schema: payloadSchema, handle };
  }

  function runnerWith(...handlers: TaskHandler[]): TaskRunner {
    return new TaskRunner(
      repository,
      handlers,
      clock,
      context,
      new PinoLogger({ pinoHttp: { level: 'silent' } }),
    );
  }

  beforeAll(async () => {
    ctx = await PostgresTestContext.start();
    repository = ctx.dataSource.getRepository(BackgroundTask);
  }, 30_000);

  beforeEach(async () => {
    await ctx.reset();
    clock = new FakeClock(new Date('2026-03-01T12:00:00.000Z'));
    cls = new ClsService(new AsyncLocalStorage());
    context = new RequestContextService(cls);
    queue = new TaskQueue(repository, clock, context);
  });

  afterAll(() => ctx.stop());

  async function reload(id: string): Promise<BackgroundTask> {
    return repository.findOneOrFail({ where: { id } });
  }

  it('runs a due task once and marks it succeeded', async () => {
    const seen: number[] = [];
    const task = await queue.enqueue('send_email', { n: 1 });

    const result = await runnerWith(handler(async (p) => void seen.push(p.n))).drainOnce();

    expect(result).toEqual({ claimed: 1, succeeded: 1, failed: 0 });
    expect(seen).toEqual([1]);
    expect((await reload(task.id)).status).toBe('succeeded');
    // Nothing left to do, so a second drain claims nothing.
    expect((await runnerWith(handler(async () => {})).drainOnce()).claimed).toBe(0);
  });

  it('does not claim a task that is not due yet', async () => {
    await queue.enqueue('send_email', { n: 1 }, { runAfter: new Date('2026-03-01T13:00:00.000Z') });

    expect((await runnerWith(handler(async () => {})).drainOnce()).claimed).toBe(0);

    clock.set(new Date('2026-03-01T13:00:00.000Z'));
    expect((await runnerWith(handler(async () => {})).drainOnce()).claimed).toBe(1);
  });

  describe('SKIP LOCKED', () => {
    it('skips rows another transaction holds instead of blocking on them', async () => {
      for (let n = 0; n < 10; n += 1) await queue.enqueue('send_email', { n });

      const handled: number[] = [];
      const runner = runnerWith(handler(async (p) => void handled.push(p.n)));

      // Hold row locks on five tasks in a transaction that stays open, exactly
      // as another worker mid-claim would. With a plain FOR UPDATE, drainOnce
      // would block here until the lock released and this test would time out.
      const locker = ctx.dataSource.createQueryRunner();
      await locker.connect();
      await locker.startTransaction();
      try {
        const locked: { id: string }[] = await locker.query(
          `SELECT id FROM background_task ORDER BY id LIMIT 5 FOR UPDATE`,
        );
        expect(locked).toHaveLength(5);

        const result = await runner.drainOnce(10);

        expect(result.claimed).toBe(5);
        expect(handled).toHaveLength(5);
      } finally {
        await locker.commitTransaction();
        await locker.release();
      }

      // Once the other worker lets go, the remaining five are claimable.
      expect((await runner.drainOnce(10)).claimed).toBe(5);
      expect(new Set(handled).size).toBe(10);
    });

    it('never runs a task twice when drains overlap', async () => {
      for (let n = 0; n < 30; n += 1) await queue.enqueue('send_email', { n });

      const handled: number[] = [];
      const runner = runnerWith(
        handler(async (p) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          handled.push(p.n);
        }),
      );

      const results = await Promise.all([
        runner.drainOnce(10),
        runner.drainOnce(10),
        runner.drainOnce(10),
      ]);

      expect(results.reduce((sum, r) => sum + r.claimed, 0)).toBe(30);
      expect(handled).toHaveLength(30);
      expect(new Set(handled).size).toBe(30);
    });
  });

  describe('failure handling', () => {
    it('retries with exponential backoff, then goes dead after the last attempt', async () => {
      const task = await queue.enqueue('send_email', { n: 1 });
      const runner = runnerWith(
        handler(async () => {
          throw new Error('smtp down');
        }),
      );

      for (let attempt = 1; attempt < MAX_TASK_ATTEMPTS; attempt += 1) {
        expect((await runner.drainOnce()).failed).toBe(1);

        const after = await reload(task.id);
        expect(after.status).toBe('pending');
        expect(after.attempts).toBe(attempt);
        expect(after.lastError).toBe('smtp down');
        expect(after.runAfter.getTime()).toBe(clock.now().getTime() + computeBackoffMs(attempt));

        // Not due until the backoff has elapsed.
        expect((await runner.drainOnce()).claimed).toBe(0);
        clock.advance(computeBackoffMs(attempt));
      }

      // The final attempt parks it as dead, and a dead task is never claimed.
      expect((await runner.drainOnce()).failed).toBe(1);
      const dead = await reload(task.id);
      expect(dead.status).toBe('dead');
      expect(dead.attempts).toBe(MAX_TASK_ATTEMPTS);

      clock.advance(24 * 60 * 60_000);
      expect((await runner.drainOnce()).claimed).toBe(0);
    });

    it('kills a task with an invalid payload immediately instead of retrying', async () => {
      let ran = false;
      const task = await queue.enqueue('send_email', { n: 'not-a-number' });

      const result = await runnerWith(handler(async () => void (ran = true))).drainOnce();

      expect(result.failed).toBe(1);
      expect(ran).toBe(false);
      const after = await reload(task.id);
      expect(after.status).toBe('dead');
      // One readable line naming the field, not a multi-line JSON dump.
      expect(after.lastError).toMatch(/^Invalid payload — n: /);
      expect(after.lastError).not.toContain('\n');
    });

    it('kills a task whose type has no registered handler', async () => {
      const task = await queue.enqueue('send_email', { n: 1 });

      await runnerWith().drainOnce();

      const after = await reload(task.id);
      expect(after.status).toBe('dead');
      expect(after.lastError).toMatch(/No handler registered/);
    });

    it('reclaims a task left running by a crashed process', async () => {
      const seen: number[] = [];
      const task = await queue.enqueue('send_email', { n: 7 });
      await repository.update(task.id, {
        status: 'running',
        lockedAt: new Date(clock.now().getTime() - 11 * 60_000),
      });

      const result = await runnerWith(handler(async (p) => void seen.push(p.n))).drainOnce();

      expect(result.succeeded).toBe(1);
      expect(seen).toEqual([7]);
    });

    it('leaves a recently claimed running task alone', async () => {
      const task = await queue.enqueue('send_email', { n: 7 });
      await repository.update(task.id, {
        status: 'running',
        lockedAt: new Date(clock.now().getTime() - 60_000),
      });

      expect((await runnerWith(handler(async () => {})).drainOnce()).claimed).toBe(0);
    });
  });

  describe('transactional enqueue', () => {
    it('never runs a task enqueued inside a rolled-back transaction', async () => {
      await expect(
        ctx.dataSource.transaction(async (manager) => {
          await queue.enqueue('send_email', { n: 1 }, { manager });
          throw new Error('registration failed');
        }),
      ).rejects.toThrow('registration failed');

      expect(await repository.count()).toBe(0);
      expect((await runnerWith(handler(async () => {})).drainOnce()).claimed).toBe(0);
    });

    it('keeps a task enqueued inside a committed transaction', async () => {
      await ctx.dataSource.transaction((manager) =>
        queue.enqueue('send_email', { n: 1 }, { manager }),
      );

      expect((await runnerWith(handler(async () => {})).drainOnce()).succeeded).toBe(1);
    });
  });

  it("runs the handler under the enqueuing request's correlation id", async () => {
    let seenInHandler: string | undefined;
    const runner = runnerWith(
      handler(async () => {
        seenInHandler = context.correlationId;
      }),
    );

    await cls.run(async () => {
      cls.set('correlationId', 'req-abc-123');
      await queue.enqueue('send_email', { n: 1 });
    });
    // The drain runs outside any request, as the scheduler's tick does.
    await runner.drainOnce();

    expect(seenInHandler).toBe('req-abc-123');
  });
});
