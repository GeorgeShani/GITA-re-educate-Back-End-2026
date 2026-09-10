// Realistic reviews across a broad slice of the catalog, from seeded
// customers — so product pages, the admin review-moderation queue, and
// rating aggregates all have real variety instead of every product
// showing "no reviews yet". Run with:
//   npm run seed:reviews
//
// Requires users, products, and (for isVerifiedPurchase to mean
// anything) orders to already be seeded. NOT idempotent — re-running
// adds another batch; safe to run once per fresh seed:reset.
import { existsSync } from 'node:fs';

import mongoose, { Types } from 'mongoose';

import { OrderSchema } from '../src/orders/schemas/order.schema';
import { ProductSchema } from '../src/catalog/schemas/product.schema';
import { Role } from '../src/common/enums/role.enum';
import { ReviewSchema } from '../src/reviews/schemas/review.schema';
import { UserSchema } from '../src/users/schemas/user.schema';
import { RATING_WEIGHTS, REVIEW_TEMPLATES } from './seed-data/reviews';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Not every product has reviews yet in real life either — a brand new
// listing with zero reviews is itself a realistic state to keep around,
// not a gap to paper over.
const REVIEW_COVERAGE = 0.7;
const MIN_REVIEWS_PER_PRODUCT = 1;
const MAX_REVIEWS_PER_PRODUCT = 6;

function withIds<T>(docs: unknown[]): ({ _id: Types.ObjectId } & T)[] {
  return docs as ({ _id: Types.ObjectId } & T)[];
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeightedRating(): number {
  const total = RATING_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [rating, weight] of RATING_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return rating;
  }
  return RATING_WEIGHTS[0][0];
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

interface SeedProductDoc {
  _id: Types.ObjectId;
}

interface SeedUserDoc {
  _id: Types.ObjectId;
}

interface SeedOrderDoc {
  userId: Types.ObjectId;
  items: { productId: Types.ObjectId }[];
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
  const ReviewModel = mongoose.model('Review', ReviewSchema);

  const customers = withIds<SeedUserDoc>(
    await UserModel.find({ roles: Role.CUSTOMER }).exec(),
  );
  const products = withIds<SeedProductDoc>(await ProductModel.find().exec());
  const orders = withIds<SeedOrderDoc>(
    await OrderModel.find({}, { userId: 1, items: 1 }).exec(),
  );

  if (customers.length === 0) {
    throw new Error('No customers exist yet — run `npm run seed:users` first.');
  }
  if (products.length === 0) {
    throw new Error(
      'No products exist yet — run `npm run seed:catalog` first.',
    );
  }

  // (userId, productId) pairs this customer has actually bought, per the
  // seeded order history — Review.isVerifiedPurchase should mean
  // something, not be a coin flip independent of the orders script.
  const purchasedPairs = new Set<string>();
  for (const order of orders) {
    for (const item of order.items) {
      purchasedPairs.add(
        `${order.userId.toString()}:${item.productId.toString()}`,
      );
    }
  }

  console.log(`\nGenerating reviews across ${products.length} products...`);
  let created = 0;

  for (const product of products) {
    if (Math.random() > REVIEW_COVERAGE) continue;

    const reviewCount = randomInt(
      MIN_REVIEWS_PER_PRODUCT,
      MAX_REVIEWS_PER_PRODUCT,
    );
    const reviewers = new Set<SeedUserDoc>();
    while (reviewers.size < Math.min(reviewCount, customers.length)) {
      reviewers.add(pick(customers));
    }

    for (const reviewer of reviewers) {
      const rating = pickWeightedRating();
      const template = pick(REVIEW_TEMPLATES[rating]);
      const isVerifiedPurchase = purchasedPairs.has(
        `${reviewer._id.toString()}:${product._id.toString()}`,
      );

      const createdAt = daysAgo(randomInt(1, 150));

      await new ReviewModel({
        productId: product._id,
        userId: reviewer._id,
        rating,
        title: template.title,
        body: template.body,
        isVerifiedPurchase,
        status: 'approved',
        createdAt,
        updatedAt: createdAt,
      }).save();
      created++;
    }
  }

  // Roll the new ratings up onto each product — the app maintains
  // Product.ratingAverage/ratingCount via ProductRatingService when a
  // review is submitted/approved through the API, but a direct insert
  // like this one skips that, so do the same aggregation here.
  console.log('\nRecomputing product rating aggregates...');
  const stats = await ReviewModel.aggregate<{
    _id: Types.ObjectId;
    avg: number;
    count: number;
  }>([
    { $match: { status: 'approved' } },
    {
      $group: {
        _id: '$productId',
        avg: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  await ProductModel.updateMany({}, { ratingAverage: 0, ratingCount: 0 });
  await ProductModel.bulkWrite(
    stats.map((s) => ({
      updateOne: {
        filter: { _id: s._id },
        update: {
          ratingAverage: Math.round(s.avg * 10) / 10,
          ratingCount: s.count,
        },
      },
    })),
  );
  console.log(`Updated aggregates on ${stats.length} products.`);

  console.log(`\nDone. ${created} reviews created.`);
  await mongoose.disconnect();
}

void main();
