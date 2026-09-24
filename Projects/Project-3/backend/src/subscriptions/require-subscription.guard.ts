import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { REQUIRES_SUBSCRIPTION_KEY } from './requires-subscription.decorator.js';
import { SubscriptionsService } from './subscriptions.service.js';

/**
 * Global, and the third guard in `AccessControlModule`: it needs the tenant
 * `AuthGuard` puts in request context. Acts only on routes marked
 * `@RequiresSubscription()`.
 */
@Injectable()
export class RequireSubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptions: SubscriptionsService,
    private readonly context: RequestContextService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean | undefined>(
      REQUIRES_SUBSCRIPTION_KEY,
      [executionContext.getHandler(), executionContext.getClass()],
    );
    if (!required) return true;

    // No tenant means the route is `@Public()` yet asks for a subscription —
    // a wiring mistake. Refuse rather than let it through unchecked.
    const companyId = this.context.companyId;
    if (!companyId) throw new UnauthorizedException('Authentication is required');

    if (await this.subscriptions.exists(companyId)) return true;

    throw new HttpException(
      'No plan selected yet. Choose one with POST /subscriptions/me to use this feature.',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
