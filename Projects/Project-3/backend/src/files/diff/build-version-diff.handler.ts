import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { TaskHandler } from '#/core/tasks/task-handler.js';
import { RowDiffService } from './row-diff.service.js';

const payloadSchema = z.object({ diffId: z.uuid(), companyId: z.uuid() });
export type BuildVersionDiffPayload = z.infer<typeof payloadSchema>;

/** Builds the row-by-row comparison of two versions in the background; the `version_diff` row is what a page waits on. */
@Injectable()
export class BuildVersionDiffHandler implements TaskHandler<BuildVersionDiffPayload> {
  readonly type = 'build_version_diff' as const;
  readonly schema = payloadSchema;

  constructor(private readonly diffs: RowDiffService) {}

  async handle({ diffId, companyId }: BuildVersionDiffPayload): Promise<void> {
    await this.diffs.run(diffId, companyId);
  }

  async onDead({ diffId, companyId }: BuildVersionDiffPayload): Promise<void> {
    await this.diffs.giveUp(diffId, companyId);
  }
}
