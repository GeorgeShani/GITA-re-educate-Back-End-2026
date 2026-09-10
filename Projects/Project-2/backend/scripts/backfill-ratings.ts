// Recomputes Product.ratingAverage / ratingCount from approved reviews.
// The app keeps these in sync via ProductRatingService on every review
// submit/approve, but a bulk import (or a DB seeded before this ran)
// leaves them at 0 — this is the one-shot catch-up. Run with:
//   npm run backfill-ratings
import { existsSync } from 'node:fs';

import mongoose, { Types } from 'mongoose';

import { ProductSchema } from '../src/catalog/schemas/product.schema';
import { ReviewSchema } from '../src/reviews/schemas/review.schema';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(mongoUri);
  const ProductModel = mongoose.model('Product', ProductSchema);
  const ReviewModel = mongoose.model('Review', ReviewSchema);

  const stats = await ReviewModel.aggregate<{
    _id: Types.ObjectId;
    avg: number;
    count: number;
  }>([
    { $match: { status: 'approved' } },
    {
      $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } },
    },
  ]);

  await ProductModel.updateMany({}, { ratingAverage: 0, ratingCount: 0 });
  if (stats.length > 0) {
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
  }

  console.log(`Updated rating aggregates on ${stats.length} products.`);
  await mongoose.disconnect();
}

void main();
