import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { TaskHandler } from '#/core/tasks/task-handler.js';
import { CleaningService } from './cleaning.service.js';

const payloadSchema = z.object({ jobId: z.uuid(), companyId: z.uuid() });
export type ApplyCleaningRecipePayload = z.infer<typeof payloadSchema>;

/**
 * Writes the cleaned data as the next version of a file's dataset, in the background. The job row is what a page waits on; the
 * work itself is `CleaningService.run`, which decides what is permanent (the job fails, the task succeeds) and what is worth a
 * retry (it throws).
 */
@Injectable()
export class ApplyCleaningRecipeHandler implements TaskHandler<ApplyCleaningRecipePayload> {
  readonly type = 'apply_cleaning_recipe' as const;
  readonly schema = payloadSchema;

  constructor(private readonly cleaning: CleaningService) {}

  async handle({ jobId, companyId }: ApplyCleaningRecipePayload): Promise<void> {
    await this.cleaning.run(jobId, companyId);
  }

  async onDead({ jobId, companyId }: ApplyCleaningRecipePayload): Promise<void> {
    await this.cleaning.giveUp(jobId, companyId);
  }
}
