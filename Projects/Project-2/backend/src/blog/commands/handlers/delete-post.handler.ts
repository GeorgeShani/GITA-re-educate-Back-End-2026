import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { PostDeletedEvent } from '@/blog/events/post-deleted.event';
import { Post, PostDocument } from '@/blog/schemas/post.schema';
import { DeletePostCommand } from '@/blog/commands/delete-post.command';

@CommandHandler(DeletePostCommand)
export class DeletePostHandler
  extends TransactionalCommandHandler<DeletePostCommand>
  implements ICommandHandler<DeletePostCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: DeletePostCommand): Promise<void> {
    await this.withTransaction(async (session) => {
      const post = await this.postModel
        .findById(command.postId)
        .session(session);
      if (!post) {
        throw new NotFoundException(`Post with id ${command.postId} not found`);
      }

      await post.deleteOne({ session });

      await this.outboxRepository.write(
        new PostDeletedEvent(command.postId, post.title, command.correlationId),
        session,
      );
    });
  }
}
