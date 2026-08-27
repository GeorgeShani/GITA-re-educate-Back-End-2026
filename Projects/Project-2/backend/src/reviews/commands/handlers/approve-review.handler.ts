import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { ReviewApprovedEvent } from '../../events/review-approved.event';
import { ProductRatingService } from '../../product-rating.service';
import { Review, ReviewDocument } from '../../schemas/review.schema';
import { ApproveReviewCommand } from '../approve-review.command';

@CommandHandler(ApproveReviewCommand)
export class ApproveReviewHandler
  extends TransactionalCommandHandler<ApproveReviewCommand>
  implements ICommandHandler<ApproveReviewCommand>
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

  async execute(command: ApproveReviewCommand): Promise<ReviewDocument> {
    return this.withTransaction(async (session) => {
      const review = await this.reviewModel
        .findById(command.reviewId)
        .session(session);
      if (!review) {
        throw new NotFoundException(
          `Review with id ${command.reviewId} not found`,
        );
      }

      review.status = 'approved';
      await review.save({ session });
      await this.productRatingService.recompute(
        review.productId.toString(),
        session,
      );

      await this.outboxRepository.write(
        new ReviewApprovedEvent(
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
