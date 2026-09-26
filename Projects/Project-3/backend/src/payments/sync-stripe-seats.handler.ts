import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import type { TaskHandler } from '#/core/tasks/task-handler.js';
import { BillingAccount } from './billing-account.entity.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { SeatSync } from './seat-sync.entity.js';

const payloadSchema = z.object({ companyId: z.uuid() }).strict();
type Payload = z.infer<typeof payloadSchema>;

@Injectable()
export class SyncStripeSeatsHandler implements TaskHandler<Payload> {
  readonly type = 'sync_stripe_seats' as const;
  readonly schema = payloadSchema;

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle(payload: Payload): Promise<void> {
    for (;;) {
      const next = await this.dataSource.getRepository(SeatSync).findOne({
        where: { companyId: payload.companyId, status: 'pending' },
        order: { sequence: 'ASC' },
      });
      if (!next) return;
      const account = await this.dataSource.getRepository(BillingAccount).findOneBy({
        companyId: payload.companyId,
      });
      if (!account?.stripeSubscriptionId) return;
      await this.provider.syncSeatQuantity({
        subscriptionId: account.stripeSubscriptionId,
        quantity: next.activeEmployees,
        effectiveAt: next.effectiveAt,
        idempotencyKey: `seat:${next.companyId}:${next.sequence}`,
      });
      await this.dataSource.getRepository(SeatSync).update(
        { id: next.id, status: 'pending' },
        { status: 'succeeded', deliveredAt: this.clock.now() },
      );
    }
  }
}
