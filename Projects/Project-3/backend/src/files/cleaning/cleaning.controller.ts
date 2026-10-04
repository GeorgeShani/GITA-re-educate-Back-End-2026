import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseInterceptors } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { IdempotencyInterceptor } from '#/core/idempotency/idempotency.interceptor.js';
import { toDto } from '#/common/response/to-dto.js';
import { DemoWritesCheckedByHandler } from '#/demo/demo-writes-checked.decorator.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import {
  CleanFileDto,
  CleanPreviewDto,
  CleanPreviewResultDto,
  CleaningJobDto,
  DatasetSettingsDto,
  UpdateDatasetSettingsDto,
} from './cleaning.dto.js';
import { CleaningService } from './cleaning.service.js';
import type { CleaningJob } from './cleaning-job.entity.js';
import { stepOutcomesOf } from './job-view.js';

/**
 * Cleaning a file, and what is saved about the dataset it belongs to. Who may do what is decided in the service by the same
 * rules as every other route about a file (a file the caller cannot see is a 404; only its uploader or an admin may change it).
 */
@ApiTags('files')
@ApiBearerAuth()
@RequiresSubscription()
@Roles('admin', 'employee')
@RequireScopes('files:write')
@Controller()
export class CleaningController {
  constructor(private readonly cleaning: CleaningService) {}

  /** A dry run: a POST only because the recipe is a body. It writes nothing, so the demo company may run it. */
  @Post('files/:id/clean/preview')
  @DemoWritesCheckedByHandler()
  @HttpCode(200)
  @ApiOkResponse({ type: CleanPreviewResultDto })
  async preview(@Param('id', ParseUUIDPipe) id: string, @Body() body: CleanPreviewDto): Promise<CleanPreviewResultDto> {
    return toDto(CleanPreviewResultDto, await this.cleaning.preview(id, body));
  }

  @Post('files/:id/clean')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'A UUID. A retry with the same key and the same recipe replays the first response instead of starting a second cleaning.',
  })
  @HttpCode(202)
  @ApiAcceptedResponse({ type: CleaningJobDto })
  async clean(@Param('id', ParseUUIDPipe) id: string, @Body() body: CleanFileDto): Promise<CleaningJobDto> {
    return this.toJobDto(await this.cleaning.start(id, body));
  }

  @Get('files/:id/clean/jobs/:jobId')
  @RequireScopes('files:read')
  @ApiOkResponse({ type: CleaningJobDto })
  async job(@Param('id', ParseUUIDPipe) id: string, @Param('jobId', ParseUUIDPipe) jobId: string): Promise<CleaningJobDto> {
    return this.toJobDto(await this.cleaning.job(id, jobId));
  }

  @Get('datasets/:datasetId/settings')
  @RequireScopes('files:read')
  @ApiOkResponse({ type: DatasetSettingsDto })
  async settings(@Param('datasetId', ParseUUIDPipe) datasetId: string): Promise<DatasetSettingsDto> {
    return toDto(DatasetSettingsDto, await this.cleaning.settings(datasetId));
  }

  @Put('datasets/:datasetId/settings')
  @ApiOkResponse({ type: DatasetSettingsDto })
  async saveSettings(
    @Param('datasetId', ParseUUIDPipe) datasetId: string,
    @Body() body: UpdateDatasetSettingsDto,
  ): Promise<DatasetSettingsDto> {
    return toDto(DatasetSettingsDto, await this.cleaning.saveSettings(datasetId, body));
  }

  private toJobDto(job: CleaningJob): CleaningJobDto {
    return toDto(CleaningJobDto, {
      id: job.id,
      fileId: job.fileId,
      status: job.status,
      trigger: job.trigger,
      resultFileId: job.resultFileId,
      errorMessage: job.errorMessage,
      steps: stepOutcomesOf(job.steps),
      rowsBefore: job.rowsBefore,
      rowsAfter: job.rowsAfter,
      createdAt: job.createdAt,
    });
  }
}
