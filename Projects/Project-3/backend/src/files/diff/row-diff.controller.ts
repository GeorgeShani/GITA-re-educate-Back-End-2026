import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, StreamableFile } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { toDto } from '#/common/response/to-dto.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import { RowDiffDto, RowDiffRequestDto } from './row-diff.dto.js';
import { RowDiffService } from './row-diff.service.js';

/** The rows that changed between two versions of a file. Both versions must be ones the caller can see (else a 404, as for `compare`). */
@ApiTags('files')
@ApiBearerAuth()
@RequiresSubscription()
@Roles('admin', 'employee')
@RequireScopes('files:read')
@Controller('files')
export class RowDiffController {
  constructor(private readonly diffs: RowDiffService) {}

  @Get(':id/compare/:otherId/rows')
  @ApiOkResponse({ type: RowDiffDto })
  async view(@Param('id', ParseUUIDPipe) id: string, @Param('otherId', ParseUUIDPipe) otherId: string): Promise<RowDiffDto> {
    return toDto(RowDiffDto, await this.diffs.view(id, otherId));
  }

  @Post(':id/compare/:otherId/rows')
  @HttpCode(202)
  @ApiAcceptedResponse({ type: RowDiffDto })
  async start(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('otherId', ParseUUIDPipe) otherId: string,
    @Body() body: RowDiffRequestDto,
  ): Promise<RowDiffDto> {
    return toDto(RowDiffDto, await this.diffs.start(id, otherId, body.keyColumns));
  }

  @Get(':id/compare/:otherId/rows.csv')
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'Every change as a CSV file.', content: { 'text/csv': { schema: { type: 'string' } } } })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'private, no-store')
  async csv(@Param('id', ParseUUIDPipe) id: string, @Param('otherId', ParseUUIDPipe) otherId: string): Promise<StreamableFile> {
    const { name, body } = await this.diffs.csv(id, otherId);
    const safe = name.replace(/[^\w .()-]/g, '_');
    return new StreamableFile(Buffer.from(body, 'utf8'), { disposition: `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(name)}` });
  }
}
