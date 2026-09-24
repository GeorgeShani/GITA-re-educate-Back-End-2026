import 'reflect-metadata';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host.js';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { RequireSubscriptionGuard } from './require-subscription.guard.js';
import { RequiresSubscription } from './requires-subscription.decorator.js';
import { SubscriptionsService } from './subscriptions.service.js';

@RequiresSubscription()
class GuardedController {
  handler(): void {}
}

class OpenController {
  handler(): void {}
}

class RouteLevelController {
  @RequiresSubscription()
  handler(): void {}

  other(): void {}
}

function contextFor(target: new () => object, method: 'handler' | 'other' = 'handler') {
  const handler = Reflect.get(target.prototype, method);
  return new ExecutionContextHost([], target, handler);
}

async function guardWith(options: { companyId: string | undefined; hasSubscription: boolean }) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      RequireSubscriptionGuard,
      Reflector,
      { provide: RequestContextService, useValue: { companyId: options.companyId } },
      { provide: SubscriptionsService, useValue: { exists: async () => options.hasSubscription } },
    ],
  }).compile();
  return moduleRef.get(RequireSubscriptionGuard);
}

describe('RequireSubscriptionGuard', () => {
  it('lets through a route that does not ask for a subscription, even with none', async () => {
    const guard = await guardWith({ companyId: 'c1', hasSubscription: false });

    expect(await guard.canActivate(contextFor(OpenController))).toBe(true);
  });

  it('lets through a company that has a plan', async () => {
    const guard = await guardWith({ companyId: 'c1', hasSubscription: true });

    expect(await guard.canActivate(contextFor(GuardedController))).toBe(true);
  });

  it('answers 402, naming plan selection, when the company has no plan', async () => {
    const guard = await guardWith({ companyId: 'c1', hasSubscription: false });

    const attempt = guard.canActivate(contextFor(GuardedController));

    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await expect(attempt).rejects.toMatchObject({
      status: 402,
      message: expect.stringMatching(/POST \/subscriptions\/me/),
    });
  });

  it('works when the decorator is on the route, not the class', async () => {
    const guard = await guardWith({ companyId: 'c1', hasSubscription: false });

    await expect(guard.canActivate(contextFor(RouteLevelController, 'handler'))).rejects.toMatchObject({ status: 402 });
    expect(await guard.canActivate(contextFor(RouteLevelController, 'other'))).toBe(true);
  });

  it('refuses rather than passes when there is no tenant — a @Public() route asking for a subscription is a wiring bug', async () => {
    const guard = await guardWith({ companyId: undefined, hasSubscription: true });

    await expect(guard.canActivate(contextFor(GuardedController))).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
