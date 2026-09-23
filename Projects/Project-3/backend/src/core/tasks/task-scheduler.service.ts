import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import type { AppConfig } from '../../config/env.schema.js';
import { APP_CONFIG } from '../../config/load-config.js';
import { TaskRunner } from './task-runner.service.js';

/**
 * Drains the queue on a fixed interval. A no-op under `NODE_ENV=test` so
 * specs drain explicitly with `drainOnce()` and stay deterministic.
 *
 * Observe instruments `@nestjs/schedule` intervals automatically, so wait
 * time, retries and failures are visible without extra code.
 */
@Injectable()
export class TaskScheduler {
  private draining = false;

  constructor(
    private readonly runner: TaskRunner,
    private readonly logger: PinoLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.logger.setContext(TaskScheduler.name);
  }

  @Interval(5_000)
  async tick(): Promise<void> {
    if (this.config.isTest || this.config.DB_SKIP_CONNECT) return;
    // Don't stack ticks if one drain outlasts the interval.
    if (this.draining) return;

    this.draining = true;
    try {
      await this.runner.drainOnce();
    } catch (error) {
      this.logger.error({ err: error }, 'Task drain failed');
    } finally {
      this.draining = false;
    }
  }
}
