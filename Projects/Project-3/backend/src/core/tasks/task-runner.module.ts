import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../database/database.module.js';
import { MailModule } from '../mail/mail.module.js';
import { SendEmailHandler } from '../mail/send-email.handler.js';
import { TASK_HANDLERS, type TaskHandler } from './task-handler.js';
import { TaskRunner } from './task-runner.service.js';
import { TaskScheduler } from './task-scheduler.service.js';

/**
 * The consumer side of the queue, and the one place every task handler is
 * registered. Nest has no multi-provider, so the list is explicit: a new task
 * type adds its owning module to `imports` and its handler to the factory
 * below. Forgetting one is not silent: the runner marks that type's tasks
 * `dead` with "No handler registered for task type …".
 */
@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot(), MailModule],
  providers: [
    {
      provide: TASK_HANDLERS,
      inject: [SendEmailHandler],
      useFactory: (sendEmail: SendEmailHandler): TaskHandler[] => [sendEmail],
    },
    TaskRunner,
    TaskScheduler,
  ],
  exports: [TaskRunner],
})
export class TaskRunnerModule {}
