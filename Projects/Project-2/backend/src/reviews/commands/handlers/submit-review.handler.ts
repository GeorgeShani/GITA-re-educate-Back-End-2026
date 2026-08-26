import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { Order, OrderDocument } from '../../../orders/schemas/order.schema';
import { OrderStatus } from '../../../orders/enums/order-status.enum';
import {
  Product,
  ProductDocument,
} from '../../../catalog/schemas/product.schema';
import { ReviewSubmittedEvent } from '../../events/review-submitted.event';
import {
  Review,
  ReviewDocument,
  ReviewStatus,
} from '../../schemas/review.schema';
import { SubmitReviewCommand } from '../submit-review.command';

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
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService,
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
        await this.recomputeProductRating(command.productId, session);
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

  private async recomputeProductRating(
    productId: string,
    session: ClientSession,
  ): Promise<void> {
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
