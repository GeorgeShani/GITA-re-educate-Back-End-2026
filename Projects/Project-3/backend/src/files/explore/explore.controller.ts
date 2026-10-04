import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { toDto } from '#/common/response/to-dto.js';
import { DemoWritesCheckedByHandler } from '#/demo/demo-writes-checked.decorator.js';
import { StrictThrottle } from '#/throttling/strict-throttle.decorator.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import { AllowanceDto, AskRequestDto, AskResultDto, ExploreRequestDto, QueryResultDto } from './explore.dto.js';
import { ExploreService } from './explore.service.js';

/** Asking a file questions: group, count and total its rows, by a query built by hand or planned by the assistant from a sentence. Reading only. */
@ApiTags('files')
@ApiBearerAuth()
@RequiresSubscription()
@Roles('admin', 'employee')
@RequireScopes('files:read')
@Controller('files/:id')
export class ExploreController {
  constructor(private readonly explore: ExploreService) {}

  /** A POST only because the query is a body: it reads and writes nothing, so the demo company may run it. */
  @Post('explore')
  @DemoWritesCheckedByHandler()
  @HttpCode(200)
  @ApiOkResponse({ type: QueryResultDto })
  async run(@Param('id', ParseUUIDPipe) id: string, @Body() body: ExploreRequestDto): Promise<QueryResultDto> {
    return toDto(QueryResultDto, await this.explore.explore(id, body.query));
  }

  /** Each answer is a call to the model, so asking has a small budget of its own on top of the plan's questions. */
  @Post('ask')
  @StrictThrottle(10)
  @HttpCode(200)
  @ApiOkResponse({ type: AskResultDto })
  async ask(@Param('id', ParseUUIDPipe) id: string, @Body() body: AskRequestDto): Promise<AskResultDto> {
    return toDto(AskResultDto, await this.explore.ask(id, body.question));
  }

  @Get('ask/allowance')
  @ApiOkResponse({ type: AllowanceDto })
  async allowance(@Param('id', ParseUUIDPipe) id: string): Promise<AllowanceDto> {
    return toDto(AllowanceDto, await this.explore.allowance(id));
  }
}
