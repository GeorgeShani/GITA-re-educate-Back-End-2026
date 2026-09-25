import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '#/common/auth/roles.decorator.js';
import { toDto } from '#/common/response/to-dto.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import { AnalyticsService } from './analytics.service.js';
import { UsageAnalyticsDto } from './dto/usage-analytics.dto.js';
import { UsageQueryDto } from './dto/usage-query.dto.js';

@ApiTags('analytics')
@ApiBearerAuth()
@RequiresSubscription()
@Roles('admin')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('usage')
  @ApiOkResponse({ type: UsageAnalyticsDto })
  async usage(@Query() query: UsageQueryDto): Promise<UsageAnalyticsDto> {
    return toDto(UsageAnalyticsDto, await this.analytics.usage(query));
  }
}
