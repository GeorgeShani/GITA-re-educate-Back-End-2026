import { z } from 'zod';

const priceSchema = z
  .object({
    id: z.string(),
    active: z.literal(true),
    currency: z.literal('usd'),
    unit_amount: z.number().int().nullable(),
    billing_scheme: z.enum(['per_unit', 'tiered']),
    tiers_mode: z.enum(['graduated', 'volume']).nullable().optional(),
    recurring: z.object({
      interval: z.literal('month'),
      usage_type: z.enum(['licensed', 'metered']),
    }),
    tiers: z
      .array(
        z.object({
          up_to: z.union([z.number().int(), z.literal('inf')]).nullable(),
          unit_amount: z.number().int().nullable(),
        }),
      )
      .nullable()
      .optional(),
  })
  .passthrough();

const meterSchema = z
  .object({ id: z.string(), status: z.literal('active'), event_name: z.string() })
  .passthrough();
const portalSchema = z
  .object({
    id: z.string(),
    active: z.literal(true),
    features: z.object({
      payment_method_update: z.object({ enabled: z.literal(true) }),
      invoice_history: z.object({ enabled: z.literal(true) }),
      subscription_cancel: z.object({ enabled: z.literal(false) }),
      subscription_update: z.object({ enabled: z.literal(false) }),
    }),
  })
  .passthrough();
const endpointSchema = z
  .object({
    id: z.string(),
    status: z.literal('enabled'),
    enabled_events: z.array(z.string()),
  })
  .passthrough();

const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.finalized',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
] as const;

export interface StripeCatalogSnapshot {
  basicBase: unknown;
  basicSeat: unknown;
  premiumBase: unknown;
  premiumOverage: unknown;
  meter: unknown;
  portal: unknown;
  webhookEndpoint: unknown;
  expectedMeterEventName: string;
}

export function verifyStripeCatalog(snapshot: StripeCatalogSnapshot): void {
  const basicBase = priceSchema.parse(snapshot.basicBase);
  const basicSeat = priceSchema.parse(snapshot.basicSeat);
  const premiumBase = priceSchema.parse(snapshot.premiumBase);
  const premiumOverage = priceSchema.parse(snapshot.premiumOverage);
  const meter = meterSchema.parse(snapshot.meter);
  portalSchema.parse(snapshot.portal);
  const endpoint = endpointSchema.parse(snapshot.webhookEndpoint);

  if (basicBase.unit_amount !== 0 || basicBase.recurring.usage_type !== 'licensed') {
    throw new Error('Basic base price must be a licensed $0 monthly price.');
  }
  if (basicSeat.unit_amount !== 500 || basicSeat.recurring.usage_type !== 'licensed') {
    throw new Error('Basic seat price must be a licensed $5 monthly price.');
  }
  if (premiumBase.unit_amount !== 30_000 || premiumBase.recurring.usage_type !== 'licensed') {
    throw new Error('Premium base price must be a licensed $300 monthly price.');
  }
  const tiers = premiumOverage.tiers ?? [];
  if (
    premiumOverage.billing_scheme !== 'tiered' ||
    premiumOverage.tiers_mode !== 'graduated' ||
    premiumOverage.recurring.usage_type !== 'metered' ||
    tiers[0]?.up_to !== 1000 ||
    tiers[0]?.unit_amount !== 0 ||
    tiers[1]?.up_to !== null ||
    tiers[1]?.unit_amount !== 50
  ) {
    throw new Error('Premium usage must be graduated: first 1000 free, then $0.50 per file.');
  }
  if (meter.event_name !== snapshot.expectedMeterEventName) {
    throw new Error('The Stripe meter event name does not match STRIPE_FILE_METER_EVENT_NAME.');
  }
  const missing = REQUIRED_EVENTS.filter((event) => !endpoint.enabled_events.includes(event));
  if (missing.length > 0) throw new Error(`Stripe webhook endpoint is missing: ${missing.join(', ')}.`);
}
