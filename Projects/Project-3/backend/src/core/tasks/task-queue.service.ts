import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { BackgroundTask, type BackgroundTaskType } from './background-task.entity.js';

export interface EnqueueOptions {
  /**
   * Enqueue inside the caller's transaction, so the task exists only if the
   * state change that caused it committed. Without this a rolled-back
   * registration could still send an activation email.
   */
  manager?: EntityManager;
  runAfter?: Date;
}

@Injectable()
export class TaskQueue {
  constructor(
    @InjectRepository(BackgroundTask) private readonly repository: Repository<BackgroundTask>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly context: RequestContextService,
  ) {}

  async enqueue(
    type: BackgroundTaskType,
    payload: unknown,
    options: EnqueueOptions = {},
  ): Promise<BackgroundTask> {
    const repository = options.manager
      ? options.manager.getRepository(BackgroundTask)
      : this.repository;

    return repository.save(
      repository.create({
        type,
        payload,
        status: 'pending',
        attempts: 0,
        runAfter: options.runAfter ?? this.clock.now(),
        lastError: null,
        lockedAt: null,
        correlationId: this.context.correlationId ?? null,
      }),
    );
  }
}
