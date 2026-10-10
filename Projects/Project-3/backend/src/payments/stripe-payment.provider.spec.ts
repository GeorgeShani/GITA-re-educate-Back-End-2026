import { describe, expect, it, vi } from 'vitest';
import { StripePaymentProvider } from './stripe-payment.provider.js';

describe('StripePaymentProvider', () => {
  it('is enabled when constructed with a complete catalog', () => {
    const provider = new StripePaymentProvider({
      secretKey: 'sk_test_example',
      webhookSecret: 'whsec_example',
      basicBasePriceId: 'price_basic_base',
      basicSeatPriceId: 'price_basic_seat',
      premiumBasePriceId: 'price_premium_base',
      premiumOveragePriceId: 'price_premium_usage',
      meterEventName: 'gridline_files',
      portalConfigurationId: 'bpc_example',
      appPublicUrl: 'https://app.gridline.test',
    });

    expect(provider.enabled).toBe(true);
  });

  describe('with a fake Stripe client', () => {
    const config = {
      secretKey: 'sk_test_example',
      webhookSecret: 'whsec_example',
      basicBasePriceId: 'price_basic_base',
      basicSeatPriceId: 'price_basic_seat',
      premiumBasePriceId: 'price_premium_base',
      premiumOveragePriceId: 'price_premium_usage',
      meterEventName: 'gridline_files',
      portalConfigurationId: 'bpc_example',
      appPublicUrl: 'https://app.gridline.test',
    };

    function providerWith(fake: Record<string, unknown>): StripePaymentProvider {
      const provider = new StripePaymentProvider(config);
      (provider as unknown as { stripe: unknown }).stripe = fake;
      return provider;
    }

    const checkoutRequest = (plan: 'basic' | 'premium', activeEmployees: number) => ({
      companyId: 'c1',
      intentId: 'i1',
      plan,
      activeEmployees,
      customerId: 'cus_1',
      billingEmail: 'billing@example.com',
      companyName: 'Acme',
    });

    function checkoutSpy() {
      const create = vi.fn(async (_params: { line_items: Array<{ price: string; quantity?: number }> }) => ({ id: 'cs_1', url: 'https://checkout.test/cs_1' }));
      return { create, provider: providerWith({ checkout: { sessions: { create } } }) };
    }

    it('starts Basic with no employees on the base price alone: Stripe refuses a seat line of quantity 0', async () => {
      const { create, provider } = checkoutSpy();
      await provider.createCheckout(checkoutRequest('basic', 0));
      expect(create.mock.calls[0]?.[0].line_items).toEqual([{ price: 'price_basic_base', quantity: 1 }]);
    });

    it('starts Basic with employees on the base price and one seat line', async () => {
      const { create, provider } = checkoutSpy();
      await provider.createCheckout(checkoutRequest('basic', 3));
      expect(create.mock.calls[0]?.[0].line_items).toEqual([
        { price: 'price_basic_base', quantity: 1 },
        { price: 'price_basic_seat', quantity: 3 },
      ]);
    });

    it('leaves Premium as it was', async () => {
      const { create, provider } = checkoutSpy();
      await provider.createCheckout(checkoutRequest('premium', 0));
      expect(create.mock.calls[0]?.[0].line_items).toEqual([{ price: 'price_premium_base', quantity: 1 }, { price: 'price_premium_usage' }]);
    });

    it('changes a subscription to Basic with no employees without a zero-quantity seat item', async () => {
      const update = vi.fn(async () => ({}));
      const provider = providerWith({
        subscriptions: { retrieve: async () => ({ items: { data: [{ id: 'si_old' }] } }), update },
      });
      await provider.changeSubscription({ subscriptionId: 'sub_1', targetPlan: 'basic', activeEmployees: 0, effectiveAt: new Date(), idempotencyKey: 'k' });
      const params = (update.mock.calls[0] as unknown as [string, { items: unknown[] }])[1];
      expect(params.items).toEqual([{ id: 'si_old', deleted: true }, { price: 'price_basic_base', quantity: 1 }]);
    });

    it('restarts the billing period without a proration date, which Stripe refuses alongside billing_cycle_anchor=now', async () => {
      const update = vi.fn(async () => ({}));
      const provider = providerWith({
        subscriptions: { retrieve: async () => ({ items: { data: [{ id: 'si_old' }] } }), update },
      });
      await provider.changeSubscription({ subscriptionId: 'sub_1', targetPlan: 'premium', activeEmployees: 3, effectiveAt: new Date(), idempotencyKey: 'k' });
      const params = (update.mock.calls[0] as unknown as [string, Record<string, unknown>])[1];
      expect(params.billing_cycle_anchor).toBe('now');
      expect(params).not.toHaveProperty('proration_date');
    });

    describe('syncSeatQuantity', () => {
      const seatRequest = (quantity: number) => ({ subscriptionId: 'sub_1', quantity, effectiveAt: new Date('2026-10-07T12:00:00Z'), idempotencyKey: 'seat:1' });

      it('adds the seat item when the first employee joins a subscription that has none', async () => {
        const create = vi.fn(async () => ({}));
        const update = vi.fn(async () => ({}));
        const provider = providerWith({
          subscriptions: { retrieve: async () => ({ id: 'sub_1', items: { data: [{ id: 'si_base', price: { id: 'price_basic_base' } }] } }) },
          subscriptionItems: { create, update },
        });
        await provider.syncSeatQuantity(seatRequest(2));
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ subscription: 'sub_1', price: 'price_basic_seat', quantity: 2 }), { idempotencyKey: 'seat:1' });
        expect(update).not.toHaveBeenCalled();
      });

      it('does nothing while there is still no seat item and still no employee', async () => {
        const create = vi.fn();
        const provider = providerWith({
          subscriptions: { retrieve: async () => ({ id: 'sub_1', items: { data: [{ id: 'si_base', price: { id: 'price_basic_base' } }] } }) },
          subscriptionItems: { create, update: vi.fn() },
        });
        await expect(provider.syncSeatQuantity(seatRequest(0))).resolves.toBeUndefined();
        expect(create).not.toHaveBeenCalled();
      });

      it('updates the seat item when there is one', async () => {
        const update = vi.fn(async () => ({}));
        const provider = providerWith({
          subscriptions: { retrieve: async () => ({ id: 'sub_1', items: { data: [{ id: 'si_seat', price: { id: 'price_basic_seat' } }] } }) },
          subscriptionItems: { create: vi.fn(), update },
        });
        await provider.syncSeatQuantity(seatRequest(4));
        expect(update).toHaveBeenCalledWith('si_seat', expect.objectContaining({ quantity: 4 }), { idempotencyKey: 'seat:1' });
      });
    });
  });
});
