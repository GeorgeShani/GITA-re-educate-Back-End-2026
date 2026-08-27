import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { CommentRepliedEvent } from '../../events/comment-replied.event';
import { Comment, CommentDocument } from '../../schemas/comment.schema';
import { ReplyToCommentCommand } from '../reply-to-comment.command';

// A reply is a new Comment threaded under the original via parentId —
// Comment has no separate adminReply field the way Review does, but it
// already models threaded replies natively, so a staff reply is just
// another comment (auto-approved, since it came from staff).
@CommandHandler(ReplyToCommentCommand)
export class ReplyToCommentHandler
  extends TransactionalCommandHandler<ReplyToCommentCommand>
  implements ICommandHandler<ReplyToCommentCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: ReplyToCommentCommand): Promise<CommentDocument> {
    return this.withTransaction(async (session) => {
      const parent = await this.commentModel
        .findById(command.parentCommentId)
        .session(session);
      if (!parent) {
        throw new NotFoundException(
          `Comment with id ${command.parentCommentId} not found`,
        );
      }

      const [reply] = await this.commentModel.create(
        [
          {
            postId: parent.postId,
            userId: new Types.ObjectId(command.adminUserId),
            authorName: 'Store Team',
            authorEmail: command.adminEmail,
            body: command.body,
            parentId: parent._id,
            status: 'approved',
          },
        ],
        { session },
      );

      await this.outboxRepository.write(
        new CommentRepliedEvent(
          reply.id,
          command.parentCommentId,
          command.correlationId,
        ),
        session,
      );

      return reply;
    });
  }
}
