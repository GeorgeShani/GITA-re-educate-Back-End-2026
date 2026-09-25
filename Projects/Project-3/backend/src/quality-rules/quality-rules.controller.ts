import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import {
  CreateQualityRuleDto,
  QualityRuleDto,
  QualityRulePageDto,
  UpdateQualityRuleDto,
} from './dto/quality-rule.dto.js';
import { QualityRulesService } from './quality-rules.service.js';

/**
 * The company's data-quality rules. Anyone signed in may READ them (an employee wants to know what an
 * upload is checked against; an API key with `files:read` may too); only an admin changes them, and
 * only with a session: the write routes declare no scope, so a key cannot reach them.
 */
@ApiTags('quality-rules')
@ApiBearerAuth()
@RequiresSubscription()
@Controller('quality-rules')
export class QualityRulesController {
  constructor(private readonly rules: QualityRulesService) {}

  @Get()
  @Roles('admin', 'employee')
  @RequireScopes('files:read')
  @ApiOkResponse({ type: QualityRulePageDto })
  async list(@Query() query: OffsetQueryDto): Promise<QualityRulePageDto> {
    return toDto(QualityRulePageDto, mapPageData(await this.rules.list(query), QualityRuleDto.from));
  }

  @Post()
  @Roles('admin')
  @ApiCreatedResponse({ type: QualityRuleDto })
  async create(@Body() dto: CreateQualityRuleDto): Promise<QualityRuleDto> {
    return QualityRuleDto.from(await this.rules.create(dto));
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOkResponse({ type: QualityRuleDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQualityRuleDto,
  ): Promise<QualityRuleDto> {
    return QualityRuleDto.from(await this.rules.update(id, dto));
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(200)
  @ApiOkResponse({ type: QualityRuleDto })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<QualityRuleDto> {
    return QualityRuleDto.from(await this.rules.remove(id));
  }
}
