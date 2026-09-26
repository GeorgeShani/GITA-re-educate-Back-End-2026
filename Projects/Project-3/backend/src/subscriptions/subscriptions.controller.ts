import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Res, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '#/common/auth/public.decorator.js';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { StrictThrottle } from '#/throttling/strict-throttle.decorator.js';
import { toDto } from '#/common/response/to-dto.js';
import { IdempotencyInterceptor } from '#/core/idempotency/idempotency.interceptor.js';
import { ChoosePlanDto } from './dto/choose-plan.dto.js';
import { PlanDto } from './dto/plan.dto.js';
import { PlanChangeResultDto, SubscriptionDto } from './dto/subscription.dto.js';
import { PendingPlanDto } from './dto/pending-plan.dto.js';
import { PLANS } from './plan-catalog.js';
import { SubscriptionsService } from './subscriptions.service.js';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  /** Public: a pricing page needs it before anyone has an account. */
  @Public()
  @Get('plans')
  @ApiOkResponse({ type: PlanDto, isArray: true })
  plans(): PlanDto[] {
    return PLANS.map((plan) => PlanDto.from(plan));
  }

  @Roles('admin', 'employee')
  @RequireScopes('files:read')
  @ApiBearerAuth()
  @Get('me')
  @ApiOkResponse({ type: SubscriptionDto })
  async me(): Promise<SubscriptionDto> {
    return toDto(SubscriptionDto, await this.subscriptions.view());
  }

  @Roles('admin')
  @ApiBearerAuth()
  // Its own small bucket: a company that has used up its plan's request budget must still
  // be able to move to a bigger plan, which is exactly what the 429 message tells it to do.
  @StrictThrottle(10)
  @Post('me')
  @ApiCreatedResponse({ type: SubscriptionDto })
  @ApiAcceptedResponse({ type: PendingPlanDto })
  async choose(
    @Body() dto: ChoosePlanDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SubscriptionDto | PendingPlanDto> {
    const result = await this.subscriptions.requestChoose(dto.plan);
    if (result.kind === 'active') return toDto(SubscriptionDto, result.view);
    response.status(HttpStatus.ACCEPTED);
    return toDto(PendingPlanDto, { state: 'pending', ...result.intent });
  }

  @Roles('admin')
  @ApiBearerAuth()
  @StrictThrottle(10)
  @Patch('me')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'A UUID. A retry with the same key and body replays the first response instead of changing the plan (and billing the proration) twice.',
  })
  @ApiOkResponse({ type: PlanChangeResultDto })
  @ApiAcceptedResponse({ type: PendingPlanDto })
  async change(
    @Body() dto: ChoosePlanDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlanChangeResultDto | PendingPlanDto> {
    const result = await this.subscriptions.requestChange(dto.plan);
    if (result.kind === 'active') {
      return toDto(PlanChangeResultDto, {
        subscription: result.view,
        previousPlan: result.previousPlan,
        prorationCents: result.prorationCents,
      });
    }
    response.status(HttpStatus.ACCEPTED);
    return toDto(PendingPlanDto, { state: 'pending', ...result.intent });
  }
}
