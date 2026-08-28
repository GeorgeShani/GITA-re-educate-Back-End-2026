import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ADMIN_ROLES } from '@/common/constants/admin-roles.constant';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { NewsletterService } from './newsletter.service';

@ApiTags('admin-newsletter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.content)
@Controller('admin/newsletter')
export class AdminNewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get('subscribers')
  @ApiOperation({ summary: 'List subscribers, any state' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.newsletterService.findAllAdmin(query);
  }

  @Get('subscribers/export')
  @ApiOperation({
    summary: 'Every confirmed, still-subscribed address (plain JSON)',
  })
  exportAll() {
    return this.newsletterService.exportAll();
  }
}
