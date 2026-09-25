import { createHash } from 'node:crypto';
import { type ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  normalizeIp,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerModuleOptions,
  type ThrottlerRequest,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { PLAN_CATALOG, type Plan } from '#/subscriptions/plan-catalog.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { STRICT_THROTTLE_KEY } from './strict-throttle.decorator.js';

/** One window for everything; the plan decides how many requests fit in it. */
export const RATE_LIMIT_WINDOW_MS = 60_000;
/** What an unauthenticated address may do per window on routes without a stricter limit of their own. */
export const ANONYMOUS_LIMIT_PER_MINUTE = 120;

const NEXT_PLAN: Readonly<Record<Plan, Plan | null>> = { free: 'basic', basic: 'premium', premium: null };

/** What a request was counted against, kept for the 429 message. */
interface Budget {
  /** `null` when no plan is involved: an address, or a route with a limit of its own. */
  plan: Plan | null;
  limit: number;
}

/**
 * The rate limiter, with the limit taken from the caller's PLAN.
 *
 * - **Authenticated** requests are counted per COMPANY (every user and API key of one
 *   company shares one budget — a key cannot be a way around the plan) at the company's
 *   plan limit. A company with no subscription yet is treated as Free.
 * - **Unauthenticated** requests are counted per client address, at a generous general limit;
 *   routes marked `@StrictThrottle` get a tighter bucket of their own instead.
 *
 * Registered right after `AuthGuard` (it needs `request.user`). It costs one indexed lookup of
 * the company's plan per authenticated request — the same order of cost as the auth re-read —
 * in exchange for a plan change taking effect on the very next request.
 *
 * Counts live in process memory (`ThrottlerStorageService`): correct for the single API
 * instance this project runs, and NOT shared across instances — scaling out would need a
 * shared store (the storage is a seam, `ThrottlerStorage`).
 */
@Injectable()
export class PlanThrottlerGuard extends ThrottlerGuard {
  private readonly budgets = new WeakMap<object, Budget>();

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectRepository(Subscription) private readonly subscriptions: Repository<Subscription>,
  ) {
    super(options, storageService, reflector);
  }

  protected override async shouldSkip(_context: ExecutionContext): Promise<boolean> {
    return !this.config.RATE_LIMIT_ENABLED;
  }

  /**
   * The company for a signed-in request, the (normalised) address otherwise. The plan is part of
   * the company's counter: once a counter has been exceeded it stays blocked for the rest of its
   * window whatever the limit later becomes, so a company that upgrades to escape a 429 must land
   * on a fresh counter for the new plan — the upgrade the message asks for has to work at once.
   */
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const companyId = companyIdOf(req);
    if (companyId) {
      const plan = this.budgets.get(req)?.plan;
      return plan ? `company:${companyId}:${plan}` : `company:${companyId}`;
    }
    return `ip:${normalizeIp(typeof req.ip === 'string' ? req.ip : '', this.ipv6SubnetPrefix)}`;
  }

  /** One bucket per tracker — except a strict route, whose bucket is its own. */
  protected override generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const scope = this.isStrict(context) ? `${context.getClass().name}.${context.getHandler().name}` : 'general';
    return createHash('sha256').update(`${name}|${scope}|${suffix}`).digest('hex');
  }

  protected override async handleRequest(props: ThrottlerRequest): Promise<boolean> {
    const { req } = this.getRequestResponse(props.context);
    const companyId = companyIdOf(req);

    if (this.isStrict(props.context) || !companyId) {
      this.budgets.set(req, { plan: null, limit: props.limit });
      return super.handleRequest(props);
    }

    const plan = await this.planOf(companyId);
    const limit = PLAN_CATALOG[plan].rateLimitPerMinute;
    this.budgets.set(req, { plan, limit });
    return super.handleRequest({ ...props, limit });
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { req, res } = this.getRequestResponse(context);
    const budget = this.budgets.get(req) ?? { plan: null, limit: detail.limit };
    const retryAfter = Math.max(1, detail.timeToBlockExpire);

    this.setResponseHeader(res, `${this.headerPrefix}-Limit`, detail.limit);
    this.setResponseHeader(res, `${this.headerPrefix}-Remaining`, 0);
    this.setResponseHeader(res, `${this.headerPrefix}-Reset`, detail.timeToExpire);

    throw new HttpException(throttleMessage(budget, retryAfter), HttpStatus.TOO_MANY_REQUESTS);
  }

  private isStrict(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(STRICT_THROTTLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private async planOf(companyId: string): Promise<Plan> {
    const subscription = await this.subscriptions.findOne({ where: { companyId }, select: { plan: true } });
    return subscription?.plan ?? 'free';
  }
}

/** The words a person reads on a 429: which plan, what it allows, when to retry, and the way up. */
export function throttleMessage(budget: Budget, retryAfterSeconds: number): string {
  if (budget.plan === null) {
    return `Too many requests. Try again in ${retryAfterSeconds} seconds.`;
  }
  const upgrade = NEXT_PLAN[budget.plan];
  const way = upgrade
    ? ` Upgrade to the ${upgrade} plan (PATCH /subscriptions/me) for ${PLAN_CATALOG[upgrade].rateLimitPerMinute} requests per minute.`
    : '';
  return `Your company's ${budget.plan} plan allows ${budget.limit} requests per minute. Try again in ${retryAfterSeconds} seconds.${way}`;
}

function companyIdOf(req: Record<string, unknown>): string | undefined {
  const user = req.user;
  if (typeof user !== 'object' || user === null || !('companyId' in user)) return undefined;
  return typeof user.companyId === 'string' ? user.companyId : undefined;
}
