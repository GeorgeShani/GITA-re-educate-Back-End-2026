import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { RolesGuard } from './common/auth/roles.guard.js';
import { ScopesGuard } from './common/auth/scopes.guard.js';
import { RequireSubscriptionGuard } from './subscriptions/require-subscription.guard.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';

/**
 * Every global guard, in the ONE place their order can be read. Nest runs
 * `APP_GUARD`s in registration order, and each depends on the one before:
 *
 *  1. `AuthGuard` — who is this? Fills `request.user` and the request context
 *     (tenant, role). Skips `@Public()` routes.
 *  2. `ScopesGuard` — for an API-key request: does the route declare a scope, and does
 *     the key hold it? (Default deny; a session passes straight through.)
 *  3. `RolesGuard` — may their role do this? Reads `request.user`. For a key that is its
 *     creator's LIVE role, so a key is never more than (role ∩ scopes).
 *  4. `RequireSubscriptionGuard` — does their company have a plan? Reads the
 *     tenant from request context. Acts only on `@RequiresSubscription()` routes.
 *
 * Swapping any two would not fail loudly: a guard that runs before its input
 * exists tends to see "no user" and skip. That is why this is one module. The
 * observable order is asserted by the `employees/` integration specs (the first
 * routes to use `@RequiresSubscription()`): an unauthenticated call must be 401
 * and a wrong-role call 403 — never 402 — on a company with no plan.
 */
@Module({
  imports: [AuthModule, SubscriptionsModule],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ScopesGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: RequireSubscriptionGuard },
  ],
})
export class AccessControlModule {}
