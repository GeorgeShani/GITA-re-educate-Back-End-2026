import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { ANONYMOUS_LIMIT_PER_MINUTE, PlanThrottlerGuard, RATE_LIMIT_WINDOW_MS } from './plan-throttler.guard.js';

/**
 * The general throttler is declared here with the ANONYMOUS limit; `PlanThrottlerGuard`
 * replaces the limit per request for signed-in callers. The guard itself is registered
 * globally by `AccessControlModule`, where its place in the guard order is visible.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: RATE_LIMIT_WINDOW_MS, limit: ANONYMOUS_LIMIT_PER_MINUTE }],
    }),
    TypeOrmModule.forFeature([Subscription]),
  ],
  providers: [PlanThrottlerGuard],
  exports: [ThrottlerModule, PlanThrottlerGuard],
})
export class ThrottlingModule {}
