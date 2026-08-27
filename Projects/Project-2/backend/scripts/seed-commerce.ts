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

  for (const coupon of COUPONS) {
    await CouponModel.findOneAndUpdate({ code: coupon.code }, coupon, {
      upsert: true,
    });
    console.log(`Coupon: ${coupon.code}`);
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

void main();
