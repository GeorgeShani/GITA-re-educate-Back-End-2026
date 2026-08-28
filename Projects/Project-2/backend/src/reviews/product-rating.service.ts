import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { Product, ProductDocument } from '@/catalog/schemas/product.schema';
import { Review, ReviewDocument } from './schemas/review.schema';

// Extracted from SubmitReviewHandler so the moderation handlers
// (Approve/RejectReviewHandler, A4) can call the exact same recompute
// a review flipping to/from 'approved' after the fact needs — rather
// than duplicating the aggregation.
@Injectable()
export class ProductRatingService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async recompute(productId: string, session: ClientSession): Promise<void> {
    const [stats] = await this.reviewModel
      .aggregate<{ avg: number; count: number }>([
        {
          $match: {
            productId: new Types.ObjectId(productId),
            status: 'approved',
          },
        },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])
      .session(session);

    await this.productModel.updateOne(
      { _id: productId },
      { ratingAverage: stats?.avg ?? 0, ratingCount: stats?.count ?? 0 },
      { session },
    );
  }
}
