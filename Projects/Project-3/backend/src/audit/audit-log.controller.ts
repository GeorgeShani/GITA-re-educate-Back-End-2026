import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '#/common/auth/roles.decorator.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { AuditLogService } from './audit-log.service.js';
import { AuditEntryDetailDto, AuditEntryDto, AuditPageDto } from './dto/audit-entry.dto.js';
import { AuditQueryDto } from './dto/audit-query.dto.js';

/** Admin only: the log records what every person in the company did. */
@ApiTags('audit')
@ApiBearerAuth()
@Roles('admin')
@Controller('audit')
export class AuditLogController {
  constructor(private readonly log: AuditLogService) {}

  @Get()
  @ApiOkResponse({ type: AuditPageDto })
  async list(@Query() query: AuditQueryDto): Promise<AuditPageDto> {
    return toDto(AuditPageDto, mapPageData(await this.log.list(query), AuditEntryDto.from));
  }

  @Get(':id')
  @ApiOkResponse({ type: AuditEntryDetailDto })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<AuditEntryDetailDto> {
    return AuditEntryDetailDto.from(await this.log.get(id));
  }
}
