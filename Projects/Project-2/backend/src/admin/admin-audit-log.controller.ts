import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@/common/enums/role.enum';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { AuditLogService } from '@/core/audit-log/audit-log.service';
import { FindAuditLogDto } from '@/core/audit-log/dto/find-audit-log.dto';

// Broadest visibility of anything in the admin surface — every domain
// event, unfiltered by area — so this stays admin-only, no delegation to
// MANAGER/SUPPORT/EDITOR the way resource-scoped routes get.
@ApiTags('admin-audit-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/audit-log')
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({
    summary:
      'Filterable event stream — the EDA payoff, visible via API (SCOPE.md Phase 6 "Audit log")',
  })
  async findAll(@Query() query: FindAuditLogDto) {
    return this.auditLogService.findAll(query);
  }
}
