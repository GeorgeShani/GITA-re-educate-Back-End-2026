import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import type { Repository } from 'typeorm';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { MAX_TASK_ATTEMPTS, nextRunAfter } from './backoff.js';
import { BackgroundTask } from './background-task.entity.js';
import { TASK_HANDLERS, type TaskHandler } from './task-handler.js';

export interface DrainResult {
  claimed: number;
  succeeded: number;
  failed: number;
}

/** A `running` task older than this belongs to a crashed process; reclaim it. */
const STALE_LOCK_MS = 10 * 60_000;

@Injectable()
export class TaskRunner {
  constructor(
    @InjectRepository(BackgroundTask) private readonly repository: Repository<BackgroundTask>,
    @Inject(TASK_HANDLERS) private readonly handlers: TaskHandler[],
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly context: RequestContextService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TaskRunner.name);
  }

  /**
   * Claims up to `limit` due tasks and runs them. The claim is one short
   * transaction using `FOR UPDATE SKIP LOCKED`: two concurrent callers get
   * disjoint rows instead of blocking on, or double-running, each other's.
   * Handlers run *outside* that transaction, so a slow handler never holds
   * row locks.
   */
  async drainOnce(limit = 10): Promise<DrainResult> {
    const claimed = await this.claim(limit);

    let succeeded = 0;
    let failed = 0;
    for (const task of claimed) {
      if (await this.runOne(task)) succeeded += 1;
      else failed += 1;
    }

    return { claimed: claimed.length, succeeded, failed };
  }

  private claim(limit: number): Promise<BackgroundTask[]> {
    const now = this.clock.now();
    const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);

    return this.repository.manager.transaction(async (manager) => {
      const due = await manager
        .createQueryBuilder(BackgroundTask, 't')
        .where(
          "(t.status = 'pending' AND t.runAfter <= :now) OR (t.status = 'running' AND t.lockedAt <= :staleBefore)",
          { now, staleBefore },
        )
        .orderBy('t.runAfter', 'ASC')
        .addOrderBy('t.id', 'ASC')
        .limit(limit)
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .getMany();

      for (const task of due) {
        task.status = 'running';
        task.lockedAt = now;
      }
      if (due.length > 0) await manager.save(due);

      return due;
    });
  }

  private async runOne(task: BackgroundTask): Promise<boolean> {
    const handler = this.handlers.find((candidate) => candidate.type === task.type);
    if (!handler) {
      await this.markDead(task, `No handler registered for task type "${task.type}"`);
      return false;
    }

    // A payload that fails its schema will never succeed — retrying is noise.
    const parsed = handler.schema.safeParse(task.payload);
    if (!parsed.success) {
      // One line per issue, not Zod's multi-line JSON dump — this lands in
      // `last_error` and in the logs, where someone reads it at a glance.
      const problems = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      await this.markDead(task, `Invalid payload — ${problems}`);
      return false;
    }

    try {
      await this.context.runWith(task.correlationId ?? randomUUID(), () =>
        handler.handle(parsed.data),
      );
      await this.repository.update(task.id, { status: 'succeeded', lockedAt: null });
      return true;
    } catch (error) {
      await this.retryOrDie(task, error);
      return false;
    }
  }

  private async retryOrDie(task: BackgroundTask, error: unknown): Promise<void> {
    const attempts = task.attempts + 1;
    const lastError = error instanceof Error ? error.message : String(error);

    if (attempts >= MAX_TASK_ATTEMPTS) {
      this.logger.error({ taskId: task.id, type: task.type, attempts }, `Task dead: ${lastError}`);
      await this.repository.update(task.id, {
        status: 'dead',
        attempts,
        lastError,
        lockedAt: null,
      });
      return;
    }

    this.logger.warn({ taskId: task.id, type: task.type, attempts }, `Task failed: ${lastError}`);
    await this.repository.update(task.id, {
      status: 'pending',
      attempts,
      lastError,
      lockedAt: null,
      runAfter: nextRunAfter(this.clock.now(), attempts),
    });
  }

  private async markDead(task: BackgroundTask, lastError: string): Promise<void> {
    this.logger.error({ taskId: task.id, type: task.type }, lastError);
    await this.repository.update(task.id, {
      status: 'dead',
      attempts: task.attempts + 1,
      lastError,
      lockedAt: null,
    });
  }
}
