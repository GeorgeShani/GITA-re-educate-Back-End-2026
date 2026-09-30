import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import type { TaskHandler } from '#/core/tasks/task-handler.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';

const payloadSchema = z.object({ subscriptionId: z.string().min(1) }).strict();
type Payload = z.infer<typeof payloadSchema>;

/**
 * Cancels a Stripe subscription that must not exist (a second Checkout was completed for a company that already has one).
 *
 * It is a queued task rather than a call made after the webhook's transaction: that call used to run AFTER the event was
 * recorded as processed, so one Stripe outage there lost the cancellation for good (the retried event was a "duplicate")
 * and the customer kept paying for a subscription nothing used. Queued in the same transaction as the event, it retries
 * with backoff until it works. Safe to run more than once: an already-ended subscription is a no-op.
 */
@Injectable()
export class CancelStripeSubscriptionHandler implements TaskHandler<Payload> {
  readonly type = 'cancel_stripe_subscription' as const;
  readonly schema = payloadSchema;

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle({ subscriptionId }: Payload): Promise<void> {
    await this.provider.cancelSubscription({
      subscriptionId,
      effectiveAt: this.clock.now(),
      idempotencyKey: `stale-subscription:${subscriptionId}`,
      ignoreIfEnded: true,
    });
  }
}
