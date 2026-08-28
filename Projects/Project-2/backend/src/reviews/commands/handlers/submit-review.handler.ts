import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { OrderStatus } from '@/orders/enums/order-status.enum';
import { ReviewSubmittedEvent } from '@/reviews/events/review-submitted.event';
import { ProductRatingService } from '@/reviews/product-rating.service';
import {
  Review,
  ReviewDocument,
  ReviewStatus,
} from '@/reviews/schemas/review.schema';
import { SubmitReviewCommand } from '@/reviews/commands/submit-review.command';

// Orders that never completed payment don't count toward "verified
// purchase" — everything past that gate does, including a later
// cancellation/refund, on the theory that the purchase genuinely
// happened even if it was later undone.
const UNVERIFIED_ORDER_STATUSES = [
  OrderStatus.PLACED,
  OrderStatus.PAYMENT_FAILED,
  OrderStatus.CANCELLED,
];

@CommandHandler(SubmitReviewCommand)
export class SubmitReviewHandler
  extends TransactionalCommandHandler<SubmitReviewCommand>
  implements ICommandHandler<SubmitReviewCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService,
    private readonly productRatingService: ProductRatingService,
  ) {
    super(connection);
  }

  async execute(command: SubmitReviewCommand): Promise<ReviewDocument> {
    const isVerifiedPurchase = await this.orderModel.exists({
      userId: new Types.ObjectId(command.userId),
      'items.productId': new Types.ObjectId(command.productId),
      status: { $nin: UNVERIFIED_ORDER_STATUSES },
    });

    const status: ReviewStatus = this.configService.get<boolean>(
      'REVIEWS_AUTO_APPROVE',
    )
      ? 'approved'
      : 'pending';

    return this.withTransaction(async (session) => {
      const [review] = await this.reviewModel.create(
        [
          {
            productId: new Types.ObjectId(command.productId),
            userId: new Types.ObjectId(command.userId),
            rating: command.rating,
            title: command.title,
            body: command.body,
            isVerifiedPurchase: Boolean(isVerifiedPurchase),
            photoPublicIds: command.photoPublicIds,
            status,
          },
        ],
        { session },
      );

      if (status === 'approved') {
        await this.productRatingService.recompute(command.productId, session);
      }

      await this.outboxRepository.write(
        new ReviewSubmittedEvent(
          review.id,
          command.productId,
          Boolean(isVerifiedPurchase),
          command.correlationId,
        ),
        session,
      );

      return review;
    });
  }
}
