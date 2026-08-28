import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { CommentRejectedEvent } from '@/blog/events/comment-rejected.event';
import { Comment, CommentDocument } from '@/blog/schemas/comment.schema';
import { RejectCommentCommand } from '@/blog/commands/reject-comment.command';

@CommandHandler(RejectCommentCommand)
export class RejectCommentHandler
  extends TransactionalCommandHandler<RejectCommentCommand>
  implements ICommandHandler<RejectCommentCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: RejectCommentCommand): Promise<CommentDocument> {
    return this.withTransaction(async (session) => {
      const comment = await this.commentModel
        .findById(command.commentId)
        .session(session);
      if (!comment) {
        throw new NotFoundException(
          `Comment with id ${command.commentId} not found`,
        );
      }

      comment.status = 'rejected';
      await comment.save({ session });

      await this.outboxRepository.write(
        new CommentRejectedEvent(comment.id, command.correlationId),
        session,
      );

      return comment;
    });
  }
}
