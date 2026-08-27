import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { ReviewRepliedEvent } from '../../events/review-replied.event';
import { Review, ReviewDocument } from '../../schemas/review.schema';
import { ReplyToReviewCommand } from '../reply-to-review.command';

@CommandHandler(ReplyToReviewCommand)
export class ReplyToReviewHandler
  extends TransactionalCommandHandler<ReplyToReviewCommand>
  implements ICommandHandler<ReplyToReviewCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: ReplyToReviewCommand): Promise<ReviewDocument> {
    return this.withTransaction(async (session) => {
      const review = await this.reviewModel
        .findById(command.reviewId)
        .session(session);
      if (!review) {
        throw new NotFoundException(
          `Review with id ${command.reviewId} not found`,
        );
      }

      review.adminReply = command.reply;
      await review.save({ session });

      await this.outboxRepository.write(
        new ReviewRepliedEvent(review.id, command.correlationId),
        session,
      );

      return review;
    });
  }
}
