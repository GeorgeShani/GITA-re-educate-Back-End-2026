import { Body, Controller, Get, HttpCode, Patch, Post, UseInterceptors } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '#/common/auth/public.decorator.js';
import { RequireScopes } from '#/common/auth/require-scopes.decorator.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { toDto } from '#/common/response/to-dto.js';
import { IdempotencyInterceptor } from '#/core/idempotency/idempotency.interceptor.js';
import { ChoosePlanDto } from './dto/choose-plan.dto.js';
import { PlanDto } from './dto/plan.dto.js';
import { PlanChangeResultDto, SubscriptionDto } from './dto/subscription.dto.js';
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
  @Post('me')
  @ApiCreatedResponse({ type: SubscriptionDto })
  async choose(@Body() dto: ChoosePlanDto): Promise<SubscriptionDto> {
    return toDto(SubscriptionDto, await this.subscriptions.choose(dto.plan));
  }

  @Roles('admin')
  @ApiBearerAuth()
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
  async change(@Body() dto: ChoosePlanDto): Promise<PlanChangeResultDto> {
    const { view, previousPlan, prorationCents } = await this.subscriptions.change(dto.plan);
    return toDto(PlanChangeResultDto, { subscription: view, previousPlan, prorationCents });
  }
}
