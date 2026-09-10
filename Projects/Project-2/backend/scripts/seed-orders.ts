// Realistic order history for every seeded customer — so account order
// history, order tracking, and admin's Orders/Returns panels all have
// something real to look at immediately, instead of an empty state until
// someone actually checks out. Run with:
//   npm run seed:orders
//
// Requires users and products to already be seeded (npm run seed:users,
// npm run seed:catalog) — this reads both rather than fabricating either.
// NOT idempotent by upsert (orders have no natural business key to
// re-target the way products key on slug) — re-running adds another
// batch on top. Safe to run once per fresh seed:reset.
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

import mongoose, { Types } from 'mongoose';

import { AddressSchema } from '../src/common/schemas/address.schema';
import { OrderSchema } from '../src/orders/schemas/order.schema';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { ProductSchema } from '../src/catalog/schemas/product.schema';
import { Role } from '../src/common/enums/role.enum';
import { UserSchema } from '../src/users/schemas/user.schema';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const FLAT_SHIPPING_MINOR = 599;
const FREE_SHIPPING_THRESHOLD_MINOR = 7500; // matches seed-commerce.ts's US Standard rate
const TAX_RATE = 0.0725; // matches seed-commerce.ts's US/CA rate — a flat approximation is fine for seed realism

// Weighted so a fresh database reads as a store that's actually been
// running a while: mostly settled (delivered/shipped) history, a
// realistic trickle of in-flight and problem orders, not an even split.
const STATUS_WEIGHTS: [OrderStatus, number][] = [
  [OrderStatus.DELIVERED, 40],
  [OrderStatus.SHIPPED, 15],
  [OrderStatus.FULFILLED, 10],
  [OrderStatus.CONFIRMED, 10],
  [OrderStatus.PAID, 10],
  [OrderStatus.PLACED, 8],
  [OrderStatus.CANCELLED, 4],
  [OrderStatus.PAYMENT_FAILED, 2],
  [OrderStatus.REFUNDED, 1],
];

function pickWeighted<T>(weights: [T, number][]): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return weights[weights.length - 1][0];
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateOrderNumber(): string {
  // Same shape as checkout's real PlaceOrderHandler.generateOrderNumber()
  // — a seeded order should be indistinguishable from a real one by its
  // number's format.
  return `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(randomInt(8, 20), randomInt(0, 59), randomInt(0, 59));
  return date;
}

interface SeedProductDoc {
  _id: Types.ObjectId;
  name: string;
  basePriceMinor: number;
  images: { url: string }[];
  variants: { sku: string; priceMinor?: number; isActive: boolean }[];
}

interface SeedUserDoc {
  _id: Types.ObjectId;
  addresses: { toObject: () => Record<string, unknown> }[];
}

/**
 * Every model in this script is deliberately typed `Model<unknown>` —
 * same "ad hoc seed shape, not the app's own DTOs" reasoning as
 * seed-catalog.ts's withId() — so a find() result's real type is
 * `unknown[]`; this narrows it back to "an id, and whatever else this
 * script needs" in one documented place instead of a cast at each call
 * site. Genuinely a narrowing, not a bare assertion: every field it
 * claims is one this script goes on to actually read off each document
 * a few lines below, so a real shape mismatch still fails loudly there
 * rather than being hidden by the cast.
 */
function withIds<T>(docs: unknown[]): ({ _id: Types.ObjectId } & T)[] {
  return docs as ({ _id: Types.ObjectId } & T)[];
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const UserModel = mongoose.model('User', UserSchema);
  const ProductModel = mongoose.model('Product', ProductSchema);
  const OrderModel = mongoose.model('Order', OrderSchema);
  // Registered so AddressSchema's own subdocument validators resolve —
  // Order.shippingAddress/billingAddress embed it directly.
  mongoose.model('Address', AddressSchema);

  const customers = withIds<SeedUserDoc>(
    await UserModel.find({
      roles: Role.CUSTOMER,
      'addresses.0': { $exists: true },
    }).exec(),
  );

  if (customers.length === 0) {
    throw new Error(
      'No customers with a saved address exist yet — run `npm run seed:users` first.',
    );
  }

  const products = withIds<SeedProductDoc>(
    await ProductModel.find({
      'variants.0': { $exists: true },
    }).exec(),
  );

  if (products.length === 0) {
    throw new Error(
      'No products exist yet — run `npm run seed:catalog` first.',
    );
  }

  console.log(`\nGenerating orders for ${customers.length} customers...`);
  let created = 0;

  for (const customer of customers) {
    const address = customer.addresses[0].toObject();
    const orderCount = randomInt(2, 5);

    for (let i = 0; i < orderCount; i++) {
      const lineCount = randomInt(1, 3);
      const chosen = new Set<SeedProductDoc>();
      while (chosen.size < lineCount && chosen.size < products.length) {
        chosen.add(pick(products));
      }

      const items = [...chosen].map((product) => {
        const variant = pick(
          product.variants.filter((v) => v.isActive) ?? product.variants,
        );
        const unitPriceMinor = variant.priceMinor ?? product.basePriceMinor;
        const quantity = randomInt(1, 2);
        return {
          productId: product._id,
          variantSku: variant.sku,
          nameSnapshot: product.name,
          imageUrlSnapshot: product.images[0]?.url,
          unitPriceMinor,
          quantity,
          lineTotalMinor: unitPriceMinor * quantity,
        };
      });

      const subtotalMinor = items.reduce(
        (sum, item) => sum + item.lineTotalMinor,
        0,
      );
      const shippingMinor =
        subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR
          ? 0
          : FLAT_SHIPPING_MINOR;
      const taxMinor = Math.round(subtotalMinor * TAX_RATE);
      const totalMinor = subtotalMinor + shippingMinor + taxMinor;

      const status = pickWeighted(STATUS_WEIGHTS);
      // Older orders skew toward settled statuses, recent ones toward
      // in-flight ones — a DELIVERED order placed 2 hours ago would be a
      // giveaway this is fake data, not a real purchase history.
      const isSettled = [
        OrderStatus.DELIVERED,
        OrderStatus.SHIPPED,
        OrderStatus.FULFILLED,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
      ].includes(status);
      const createdAt = isSettled
        ? daysAgo(randomInt(10, 120))
        : daysAgo(randomInt(0, 9));

      // `new Model(data).save()`, not `.create()` — Model<unknown> (this
      // script's own "ad hoc seed shape" typing, same as every other seed
      // script) makes TS misresolve every .create() overload against a
      // query-filter shape instead of a document one; `new` + `.save()`
      // doesn't share that overload set and takes the same plain object
      // Mongoose would insert either way.
      await new OrderModel({
        orderNumber: generateOrderNumber(),
        userId: customer._id,
        items,
        shippingAddress: address,
        billingAddress: address,
        subtotalMinor,
        discountMinor: 0,
        shippingMinor,
        taxMinor,
        totalMinor,
        currency: 'usd',
        status,
        cancelledReason:
          status === OrderStatus.CANCELLED
            ? 'Customer requested cancellation'
            : undefined,
        createdAt,
        updatedAt: createdAt,
      }).save();
      created++;
    }
  }

  console.log(`\nDone. ${created} orders created.`);
  await mongoose.disconnect();
}

void main();
