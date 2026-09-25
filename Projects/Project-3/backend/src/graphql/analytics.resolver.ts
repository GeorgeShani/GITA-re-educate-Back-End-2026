import { Args, GraphQLISODateTime, Query, Resolver } from '@nestjs/graphql';
import { AnalyticsService } from '#/analytics/analytics.service.js';
import { Roles } from '#/common/auth/roles.decorator.js';
import { RequiresSubscription } from '#/subscriptions/requires-subscription.decorator.js';
import { UsageAnalyticsType } from './analytics.types.js';

/**
 * The read-only GraphQL surface: the same analytics as `GET /analytics/usage`, from the same
 * `AnalyticsService` (and so the same `analytics.queries.ts` functions), so the two cannot
 * disagree. Protected by the SAME global guard chain, which reads the request through
 * `requestOf`: signed-in admins only, a plan required, and NO `@RequireScopes` — so an API key
 * is refused by construction. There are no mutations anywhere in the schema.
 */
@Resolver()
@Roles('admin')
@RequiresSubscription()
export class AnalyticsResolver {
  constructor(private readonly analytics: AnalyticsService) {}

  @Query(() => UsageAnalyticsType, {
    name: 'usage',
    description:
      'Usage analytics for the current company: uploads per day, per employee, storage, the quota burn-down and plan history. `from` (inclusive) and `to` (exclusive) are read as UTC days; with neither it is the current billing period so far.',
    // The whole tree is computed per call, so each selection of it has a base cost: aliasing the
    // field twenty times is how someone would try to multiply the work, and this is what prices that.
    complexity: ({ childComplexity }) => 50 + childComplexity,
  })
  async usage(
    @Args('from', { type: () => GraphQLISODateTime, nullable: true }) from?: Date,
    @Args('to', { type: () => GraphQLISODateTime, nullable: true }) to?: Date,
  ): Promise<UsageAnalyticsType> {
    return this.analytics.usage({ from, to });
  }
}
