import '#/load-env.js';
import Stripe from 'stripe';
import { loadConfig } from '#/config/load-config.js';
import { verifyStripeCatalog } from './stripe-catalog.js';

function required(value: string | undefined, key: string): string {
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const stripe = new Stripe(required(config.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY'));
  const [basicBase, basicSeat, premiumBase, premiumOverage, meter, portal, webhookEndpoint] =
    await Promise.all([
      stripe.prices.retrieve(required(config.STRIPE_BASIC_BASE_PRICE_ID, 'STRIPE_BASIC_BASE_PRICE_ID')),
      stripe.prices.retrieve(required(config.STRIPE_BASIC_SEAT_PRICE_ID, 'STRIPE_BASIC_SEAT_PRICE_ID')),
      stripe.prices.retrieve(required(config.STRIPE_PREMIUM_BASE_PRICE_ID, 'STRIPE_PREMIUM_BASE_PRICE_ID')),
      stripe.prices.retrieve(
        required(config.STRIPE_PREMIUM_OVERAGE_PRICE_ID, 'STRIPE_PREMIUM_OVERAGE_PRICE_ID'),
        { expand: ['tiers'] },
      ),
      stripe.billing.meters.retrieve(required(config.STRIPE_FILE_METER_ID, 'STRIPE_FILE_METER_ID')),
      stripe.billingPortal.configurations.retrieve(
        required(config.STRIPE_PORTAL_CONFIGURATION_ID, 'STRIPE_PORTAL_CONFIGURATION_ID'),
      ),
      stripe.webhookEndpoints.retrieve(
        required(config.STRIPE_WEBHOOK_ENDPOINT_ID, 'STRIPE_WEBHOOK_ENDPOINT_ID'),
      ),
    ]);
  verifyStripeCatalog({
    basicBase,
    basicSeat,
    premiumBase,
    premiumOverage,
    meter,
    portal,
    webhookEndpoint,
    expectedMeterEventName: required(
      config.STRIPE_FILE_METER_EVENT_NAME,
      'STRIPE_FILE_METER_EVENT_NAME',
    ),
  });
  process.stdout.write('Stripe catalog verified.\n');
}

await main();
