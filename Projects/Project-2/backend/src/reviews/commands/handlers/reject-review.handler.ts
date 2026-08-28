import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { ReviewRejectedEvent } from '@/reviews/events/review-rejected.event';
import { ProductRatingService } from '@/reviews/product-rating.service';
import { Review, ReviewDocument } from '@/reviews/schemas/review.schema';
import { RejectReviewCommand } from '@/reviews/commands/reject-review.command';

@CommandHandler(RejectReviewCommand)
export class RejectReviewHandler
  extends TransactionalCommandHandler<RejectReviewCommand>
  implements ICommandHandler<RejectReviewCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly outboxRepository: OutboxRepository,
    private readonly productRatingService: ProductRatingService,
  ) {
    super(connection);
  }

  async execute(command: RejectReviewCommand): Promise<ReviewDocument> {
    return this.withTransaction(async (session) => {
      const review = await this.reviewModel
        .findById(command.reviewId)
        .session(session);
      if (!review) {
        throw new NotFoundException(
          `Review with id ${command.reviewId} not found`,
        );
      }

      const wasApproved = review.status === 'approved';
      review.status = 'rejected';
      await review.save({ session });
      // Only rewrite the rating if this review had actually been
      // contributing to it — rejecting an already-pending review
      // doesn't need a recompute.
      if (wasApproved) {
        await this.productRatingService.recompute(
          review.productId.toString(),
          session,
        );
      }

      await this.outboxRepository.write(
        new ReviewRejectedEvent(
          review.id,
          review.productId.toString(),
          command.correlationId,
        ),
        session,
      );

      return review;
    });
  }
}
