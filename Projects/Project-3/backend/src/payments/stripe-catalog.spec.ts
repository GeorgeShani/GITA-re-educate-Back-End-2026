import { describe, expect, it } from 'vitest';
import { verifyStripeCatalog, type StripeCatalogSnapshot } from './stripe-catalog.js';

function snapshot(): StripeCatalogSnapshot {
  const licensed = (id: string, amount: number) => ({
    id,
    active: true,
    currency: 'usd',
    unit_amount: amount,
    billing_scheme: 'per_unit',
    recurring: { interval: 'month', usage_type: 'licensed' },
  });
  return {
    basicBase: licensed('price_basic_base', 0),
    basicSeat: licensed('price_basic_seat', 500),
    premiumBase: licensed('price_premium_base', 30_000),
    premiumOverage: {
      id: 'price_premium_usage',
      active: true,
      currency: 'usd',
      unit_amount: null,
      billing_scheme: 'tiered',
      tiers_mode: 'graduated',
      recurring: { interval: 'month', usage_type: 'metered' },
      tiers: [
        { up_to: 1000, unit_amount: 0 },
        { up_to: null, unit_amount: 50 },
      ],
    },
    meter: { id: 'mtr_files', status: 'active', event_name: 'gridline_files' },
    portal: {
      id: 'bpc_gridline',
      active: true,
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        subscription_cancel: { enabled: false },
        subscription_update: { enabled: false },
      },
    },
    webhookEndpoint: {
      id: 'we_gridline',
      status: 'enabled',
      enabled_events: [
        'checkout.session.completed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.finalized',
        'invoice.payment_failed',
        'invoice.payment_succeeded',
      ],
    },
    expectedMeterEventName: 'gridline_files',
  };
}

describe('verifyStripeCatalog', () => {
  it('accepts the immutable Gridline catalog', () => {
    expect(() => verifyStripeCatalog(snapshot())).not.toThrow();
  });

  it('rejects a catalog that could bill the wrong amount', () => {
    const input = snapshot();
    input.basicSeat = {
      id: 'price_basic_seat',
      active: true,
      currency: 'usd',
      unit_amount: 600,
      billing_scheme: 'per_unit',
      recurring: { interval: 'month', usage_type: 'licensed' },
    };
    expect(() => verifyStripeCatalog(input)).toThrow(/\$5/);
  });
});
