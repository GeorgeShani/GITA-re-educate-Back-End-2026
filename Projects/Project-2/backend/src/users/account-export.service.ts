import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { Review, ReviewDocument } from '@/reviews/schemas/review.schema';
import {
  WishlistItem,
  WishlistItemDocument,
} from '@/wishlist/schemas/wishlist-item.schema';
import { UsersService } from './users.service';

export interface AccountExport {
  exportedAt: string;
  profile: Record<string, unknown>;
  orders: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
  wishlist: Record<string, unknown>[];
}

// GDPR "right to access" — a reasonable, scoped export of the personal
// data a shopper can see about themselves, not a dump of every internal
// collection that happens to reference their userId (audit log rows,
// StockAdjustment.adjustedByUserId, etc. stay out of this).
@Injectable()
export class AccountExportService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(WishlistItem.name)
    private readonly wishlistItemModel: Model<WishlistItemDocument>,
    private readonly usersService: UsersService,
  ) {}

  async export(userId: string): Promise<AccountExport> {
    const [user, orders, reviews, wishlist] = await Promise.all([
      this.usersService.findById(userId),
      this.orderModel.find({ userId }).exec(),
      this.reviewModel.find({ userId }).exec(),
      this.wishlistItemModel.find({ userId }).exec(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: user.toJSON() as unknown as Record<string, unknown>,
      orders: orders.map(
        (order) => order.toJSON() as unknown as Record<string, unknown>,
      ),
      reviews: reviews.map(
        (review) => review.toJSON() as unknown as Record<string, unknown>,
      ),
      wishlist: wishlist.map(
        (item) => item.toJSON() as unknown as Record<string, unknown>,
      ),
    };
  }
}
