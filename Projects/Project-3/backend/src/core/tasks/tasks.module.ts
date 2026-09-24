import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { TaskQueue } from './task-queue.service.js';

/**
 * The producer side only: anything can enqueue. The consumer side (runner,
 * schedule, handler list) is `TaskRunnerModule`, kept separate so this module
 * never has to know about the feature modules that own handlers — a feature
 * needs `TaskQueue` to enqueue, and the runner needs that feature's handler
 * to run, which would be a cycle if they shared a module.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [TaskQueue],
  exports: [TaskQueue],
})
export class TasksModule {}
