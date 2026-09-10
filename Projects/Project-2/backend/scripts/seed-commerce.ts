// Shipping zones, tax rates, and a few test coupons — none of these
// have an admin CRUD surface either (same "no admin CRUD" gap as the
// catalog seed), and checkout genuinely cannot compute a single quote
// without at least one shipping zone. Run with:
//   npm run seed:commerce
//
// Idempotent: every upsert keys on the same fields checkout looks up
// by (countryCodes for zones, countryCode+region for tax, code for
// coupons), so re-running after editing this file is safe.
import { existsSync } from 'node:fs';

import mongoose from 'mongoose';

import { ShippingZoneSchema } from '../src/shipping/schemas/shipping-zone.schema';
import { TaxRateSchema } from '../src/tax/schemas/tax-rate.schema';
import { CouponSchema } from '../src/coupons/schemas/coupon.schema';
import { GiftCardSchema } from '../src/gift-cards/schemas/gift-card.schema';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const SHIPPING_ZONES = [
  {
    name: 'US Domestic',
    countryCodes: ['US'],
    isActive: true,
    rates: [
      {
        method: 'Standard',
        priceMinor: 599,
        freeAboveSubtotalMinor: 7500,
        estimatedDaysMin: 4,
        estimatedDaysMax: 7,
      },
      {
        method: 'Express',
        priceMinor: 1499,
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
      },
    ],
  },
  {
    name: 'International',
    countryCodes: ['CA', 'GB', 'AU', 'DE', 'FR', 'JP'],
    isActive: true,
    rates: [
      {
        method: 'Standard International',
        priceMinor: 1999,
        estimatedDaysMin: 7,
        estimatedDaysMax: 21,
      },
    ],
  },
];

const TAX_RATES = [
  { countryCode: 'US', region: 'CA', rateBasisPoints: 725, isActive: true },
  { countryCode: 'US', region: 'NY', rateBasisPoints: 800, isActive: true },
  { countryCode: 'US', region: 'TX', rateBasisPoints: 625, isActive: true },
  { countryCode: 'GB', rateBasisPoints: 2000, isActive: true }, // VAT, country-wide
];

// SUMMER30's endsAt is computed at run time (see main()), not a literal
// date here — a coupon seeded to "expire in 10 days" should actually
// expire 10 days from whenever the seed last ran, the same way a real
// merchant would set one up, not drift toward a stale fixed date every
// time this file sits unrun for a while.
const FEATURED_COUPON_WINDOW_DAYS = 10;

const COUPONS = [
  {
    code: 'WELCOME10',
    type: 'percentage' as const,
    value: 10,
    minSpendMinor: 0,
    startsAt: new Date('2020-01-01'),
    isActive: true,
  },
  {
    code: 'FREESHIP',
    type: 'free_shipping' as const,
    value: 0,
    minSpendMinor: 5000,
    startsAt: new Date('2020-01-01'),
    isActive: true,
  },
  {
    code: 'SAVE20',
    type: 'fixed' as const,
    value: 2000,
    minSpendMinor: 10000,
    globalLimit: 100,
    perUserLimit: 1,
    startsAt: new Date('2020-01-01'),
    isActive: true,
  },
  {
    code: 'HOLIDAY15',
    type: 'percentage' as const,
    value: 15,
    minSpendMinor: 15000,
    perUserLimit: 1,
    startsAt: new Date('2020-01-01'),
    isActive: false, // seasonal — on the books, deliberately not running right now
  },
  // The one real, live, currently-running promo — home.ts's sale-banner
  // fetches it via GET /coupons/featured and its own endsAt drives the
  // banner's countdown for real, not a client-side timer that reset on
  // every reload.
  {
    code: 'SUMMER30',
    type: 'percentage' as const,
    value: 30,
    minSpendMinor: 0,
    startsAt: new Date('2020-01-01'),
    isActive: true,
    isFeatured: true,
  },
];

const GIFT_CARDS = [
  {
    code: 'GIFT-100-STARTER',
    initialBalanceMinor: 10000,
    balanceMinor: 10000,
    currency: 'usd',
    isActive: true,
  },
  {
    code: 'GIFT-250-CLASSIC',
    initialBalanceMinor: 25000,
    balanceMinor: 25000,
    currency: 'usd',
    isActive: true,
  },
  {
    code: 'GIFT-50-PARTIAL',
    initialBalanceMinor: 5000,
    // Partially redeemed — a realistic in-use state, not every seeded
    // gift card sitting at full balance forever.
    balanceMinor: 2150,
    currency: 'usd',
    isActive: true,
  },
  {
    code: 'GIFT-500-VIP',
    initialBalanceMinor: 50000,
    balanceMinor: 50000,
    currency: 'usd',
    isActive: true,
  },
];

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(mongoUri);

  const ShippingZoneModel = mongoose.model('ShippingZone', ShippingZoneSchema);
  const TaxRateModel = mongoose.model('TaxRate', TaxRateSchema);
  const CouponModel = mongoose.model('Coupon', CouponSchema);
  const GiftCardModel = mongoose.model('GiftCard', GiftCardSchema);

  for (const zone of SHIPPING_ZONES) {
    await ShippingZoneModel.findOneAndUpdate({ name: zone.name }, zone, {
      upsert: true,
    });
    console.log(`Shipping zone: ${zone.name}`);
  }

  for (const rate of TAX_RATES) {
    await TaxRateModel.findOneAndUpdate(
      { countryCode: rate.countryCode, region: rate.region },
      rate,
      { upsert: true },
    );
    console.log(
      `Tax rate: ${rate.countryCode}${rate.region ? `/${rate.region}` : ''}`,
    );
  }

  const featuredEndsAt = new Date();
  featuredEndsAt.setDate(
    featuredEndsAt.getDate() + FEATURED_COUPON_WINDOW_DAYS,
  );

  for (const coupon of COUPONS) {
    const doc = coupon.isFeatured
      ? { ...coupon, endsAt: featuredEndsAt }
      : coupon;
    await CouponModel.findOneAndUpdate({ code: coupon.code }, doc, {
      upsert: true,
    });
    console.log(
      `Coupon: ${coupon.code}${coupon.isFeatured ? ` (featured, ends ${featuredEndsAt.toISOString().slice(0, 10)})` : ''}`,
    );
  }

  for (const giftCard of GIFT_CARDS) {
    await GiftCardModel.findOneAndUpdate({ code: giftCard.code }, giftCard, {
      upsert: true,
    });
    console.log(`Gift card: ${giftCard.code}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

void main();
