import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '../catalog/schemas/product.schema';
import { CoreModule } from '../core/core.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { AdminReviewsController } from './admin-reviews.controller';
import { ApproveReviewHandler } from './commands/handlers/approve-review.handler';
import { RejectReviewHandler } from './commands/handlers/reject-review.handler';
import { ReplyToReviewHandler } from './commands/handlers/reply-to-review.handler';
import { SubmitReviewHandler } from './commands/handlers/submit-review.handler';
import { ProductRatingService } from './product-rating.service';
import { Review, ReviewSchema } from './schemas/review.schema';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

const COMMAND_HANDLERS = [
  SubmitReviewHandler,
  ApproveReviewHandler,
  RejectReviewHandler,
  ReplyToReviewHandler,
];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService, ProductRatingService, ...COMMAND_HANDLERS],
})
export class ReviewsModule {}
