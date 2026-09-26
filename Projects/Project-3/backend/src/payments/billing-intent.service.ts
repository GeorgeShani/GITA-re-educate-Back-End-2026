import { randomUUID } from 'node:crypto';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { Company } from '#/database/entities/company.entity.js';
import { AuditService } from '#/core/audit/audit.service.js';
import type { PaidPlan, PaymentProvider } from './payment-provider.js';
import { PAYMENT_PROVIDER } from './payment-provider.js';
import { BillingAccount } from './billing-account.entity.js';

export interface PendingBillingIntent {
  intentId: string;
  targetPlan: 'free' | PaidPlan;
  checkoutUrl: string | null;
}

interface StagedIntent {
  intentId: string;
  previousCheckoutSessionId: string | null;
  account: BillingAccount;
  company: Company;
}

@Injectable()
export class BillingIntentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  get enabled(): boolean {
    return this.provider.enabled;
  }

  async beginCheckout(
    companyId: string,
    targetPlan: PaidPlan,
    activeEmployees: number,
  ): Promise<PendingBillingIntent> {
    const staged = await this.stage(companyId, targetPlan);
    let checkout;
    try {
      checkout = await this.provider.createCheckout({
        companyId,
        billingEmail: staged.company.billingEmail,
        customerId: staged.account.stripeCustomerId ?? undefined,
        plan: targetPlan,
        activeEmployees,
        intentId: staged.intentId,
      });
    } catch (error) {
      await this.clearIfCurrent(companyId, staged.intentId);
      throw error;
    }

    const accepted = await this.dataSource.transaction(async (manager) => {
      const account = await this.lockAccount(manager, companyId);
      if (account.pendingIntentId !== staged.intentId) return false;
      account.stripeCustomerId = checkout.customerId;
      account.pendingCheckoutSessionId = checkout.sessionId;
      await manager.save(account);
      return true;
    });

    if (!accepted) {
      await this.provider.expireCheckout(checkout.sessionId);
      throw new ConflictException('A newer billing request superseded this Checkout session.');
    }
    if (staged.previousCheckoutSessionId) {
      await this.provider.expireCheckout(staged.previousCheckoutSessionId);
    }

    return { intentId: staged.intentId, targetPlan, checkoutUrl: checkout.url };
  }

  async beginPaidChange(
    companyId: string,
    targetPlan: PaidPlan,
    activeEmployees: number,
  ): Promise<PendingBillingIntent> {
    const staged = await this.stage(companyId, targetPlan);
    const subscriptionId = staged.account.stripeSubscriptionId;
    if (!subscriptionId) {
      await this.clearIfCurrent(companyId, staged.intentId);
      throw new ConflictException('This company has no active Stripe subscription to change.');
    }
    try {
      await this.provider.changeSubscription({
        subscriptionId,
        targetPlan,
        activeEmployees,
        effectiveAt: this.clock.now(),
        idempotencyKey: `plan-change:${staged.intentId}`,
      });
    } catch (error) {
      await this.clearIfCurrent(companyId, staged.intentId);
      throw error;
    }
    return { intentId: staged.intentId, targetPlan, checkoutUrl: null };
  }

  async beginCancellation(companyId: string): Promise<PendingBillingIntent> {
    const staged = await this.stage(companyId, 'free');
    const subscriptionId = staged.account.stripeSubscriptionId;
    if (!subscriptionId) {
      await this.clearIfCurrent(companyId, staged.intentId);
      throw new ConflictException('This company has no active Stripe subscription to cancel.');
    }
    try {
      await this.provider.cancelSubscription({
        subscriptionId,
        effectiveAt: this.clock.now(),
        idempotencyKey: `plan-cancel:${staged.intentId}`,
      });
    } catch (error) {
      await this.clearIfCurrent(companyId, staged.intentId);
      throw error;
    }
    return { intentId: staged.intentId, targetPlan: 'free', checkoutUrl: null };
  }

  async portalUrl(companyId: string): Promise<string> {
    const account = await this.dataSource.getRepository(BillingAccount).findOne({ where: { companyId } });
    if (!account?.stripeCustomerId) {
      throw new NotFoundException('This company does not have a Stripe billing account yet.');
    }
    return this.provider.createPortalSession(account.stripeCustomerId);
  }

  private async stage(companyId: string, targetPlan: 'free' | PaidPlan): Promise<StagedIntent> {
    const intentId = randomUUID();
    return this.dataSource.transaction(async (manager) => {
      const company = await manager.findOneOrFail(Company, {
        where: { id: companyId },
        lock: { mode: 'pessimistic_write' },
      });
      let account = await manager.findOne(BillingAccount, {
        where: { companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) {
        account = manager.create(BillingAccount, {
          companyId,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripeSeatItemId: null,
          status: 'current',
          graceEndsAt: null,
          pendingIntentId: null,
          pendingCheckoutSessionId: null,
          pendingPlan: null,
          pendingCreatedAt: null,
          seatRevision: 0,
        });
      }
      const previousCheckoutSessionId = account.pendingCheckoutSessionId;
      account.pendingIntentId = intentId;
      account.pendingCheckoutSessionId = null;
      account.pendingPlan = targetPlan;
      account.pendingCreatedAt = this.clock.now();
      account = await manager.save(account);
      await this.audit.record(
        {
          action: 'billing.checkout_started',
          companyId,
          target: { type: 'billing_account', id: account.id },
          metadata: { intentId, targetPlan },
        },
        manager,
      );
      return { intentId, previousCheckoutSessionId, account, company };
    });
  }

  private async clearIfCurrent(companyId: string, intentId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(BillingAccount, {
        where: { companyId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account || account.pendingIntentId !== intentId) return;
      account.pendingIntentId = null;
      account.pendingCheckoutSessionId = null;
      account.pendingPlan = null;
      account.pendingCreatedAt = null;
      await manager.save(account);
    });
  }

  private async lockAccount(manager: EntityManager, companyId: string): Promise<BillingAccount> {
    const account = await manager.findOne(BillingAccount, {
      where: { companyId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!account) throw new NotFoundException('Billing account not found.');
    return account;
  }
}
