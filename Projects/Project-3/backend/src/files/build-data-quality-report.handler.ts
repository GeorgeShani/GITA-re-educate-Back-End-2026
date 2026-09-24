import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { TaskHandler } from '#/core/tasks/task-handler.js';

const payloadSchema = z.object({ fileId: z.uuid(), companyId: z.uuid() });
export type BuildDataQualityReportPayload = z.infer<typeof payloadSchema>;

/**
 * Queued by every upload, in the same transaction that stores the file. The upload
 * path is finished and correct today, so the task is real and durable already;
 * the profiling it triggers (parse the file, compute the metrics, ask the AI for a
 * narrative, store a `DataQualityReport`) is Phase 8. Until then this succeeds
 * without doing anything, which keeps the queue honest — no upload leaves a task
 * behind that fails or dies.
 */
@Injectable()
export class BuildDataQualityReportHandler implements TaskHandler<BuildDataQualityReportPayload> {
  readonly type = 'build_data_quality_report' as const;
  readonly schema = payloadSchema;

  async handle(): Promise<void> {
    // Phase 8.
  }
}
