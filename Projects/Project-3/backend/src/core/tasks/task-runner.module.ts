import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '#/database/database.module.js';
import { MailModule } from '#/core/mail/mail.module.js';
import { SendEmailHandler } from '#/core/mail/send-email.handler.js';
import { BuildDataQualityReportHandler } from '#/files/build-data-quality-report.handler.js';
import { FilesModule } from '#/files/files.module.js';
import { PaymentsModule } from '#/payments/payments.module.js';
import { ReportStripeUsageHandler } from '#/payments/report-stripe-usage.handler.js';
import { SyncStripeSeatsHandler } from '#/payments/sync-stripe-seats.handler.js';
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
  imports: [DatabaseModule, ScheduleModule.forRoot(), MailModule, FilesModule, PaymentsModule],
  providers: [
    {
      provide: TASK_HANDLERS,
      inject: [
        SendEmailHandler,
        BuildDataQualityReportHandler,
        SyncStripeSeatsHandler,
        ReportStripeUsageHandler,
      ],
      useFactory: (
        sendEmail: SendEmailHandler,
        buildReport: BuildDataQualityReportHandler,
        syncSeats: SyncStripeSeatsHandler,
        reportUsage: ReportStripeUsageHandler,
      ): TaskHandler[] => [sendEmail, buildReport, syncSeats, reportUsage],
    },
    TaskRunner,
    TaskScheduler,
  ],
  exports: [TaskRunner],
})
export class TaskRunnerModule {}
