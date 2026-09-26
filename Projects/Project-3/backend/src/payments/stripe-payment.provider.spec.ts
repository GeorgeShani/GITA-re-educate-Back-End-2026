import { describe, expect, it } from 'vitest';
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
});
