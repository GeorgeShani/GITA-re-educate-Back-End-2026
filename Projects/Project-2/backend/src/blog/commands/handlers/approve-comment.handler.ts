import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { CommentApprovedEvent } from '@/blog/events/comment-approved.event';
import { Comment, CommentDocument } from '@/blog/schemas/comment.schema';
import { ApproveCommentCommand } from '@/blog/commands/approve-comment.command';

@CommandHandler(ApproveCommentCommand)
export class ApproveCommentHandler
  extends TransactionalCommandHandler<ApproveCommentCommand>
  implements ICommandHandler<ApproveCommentCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: ApproveCommentCommand): Promise<CommentDocument> {
    return this.withTransaction(async (session) => {
      const comment = await this.commentModel
        .findById(command.commentId)
        .session(session);
      if (!comment) {
        throw new NotFoundException(
          `Comment with id ${command.commentId} not found`,
        );
      }

      comment.status = 'approved';
      await comment.save({ session });

      await this.outboxRepository.write(
        new CommentApprovedEvent(comment.id, command.correlationId),
        session,
      );

      return comment;
    });
  }
}
