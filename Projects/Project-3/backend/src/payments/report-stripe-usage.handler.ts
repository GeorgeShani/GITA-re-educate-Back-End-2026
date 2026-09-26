import { Inject, Injectable } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { z } from 'zod';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import type { TaskHandler } from '#/core/tasks/task-handler.js';
import { BillingAccount } from './billing-account.entity.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';

const payloadSchema = z.object({ usageEventId: z.uuid() }).strict();
type Payload = z.infer<typeof payloadSchema>;

@Injectable()
export class ReportStripeUsageHandler implements TaskHandler<Payload> {
  readonly type = 'report_stripe_usage' as const;
  readonly schema = payloadSchema;

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle(payload: Payload): Promise<void> {
    const usage = await this.dataSource.getRepository(UsageEvent).findOneByOrFail({ id: payload.usageEventId });
    if (usage.stripeReportedAt) return;
    const account = await this.dataSource.getRepository(BillingAccount).findOneBy({
      companyId: usage.companyId,
    });
    if (!account?.stripeCustomerId || !account.stripeSubscriptionId) return;
    await this.provider.reportUsage({
      customerId: account.stripeCustomerId,
      usageEventId: usage.id,
      occurredAt: usage.createdAt,
    });
    await this.dataSource.getRepository(UsageEvent).update(
      { id: usage.id, stripeReportedAt: IsNull() },
      { stripeReportedAt: this.clock.now() },
    );
  }
}
