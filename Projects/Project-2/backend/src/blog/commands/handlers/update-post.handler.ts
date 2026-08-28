import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { PostUpdatedEvent } from '@/blog/events/post-updated.event';
import { Post, PostDocument } from '@/blog/schemas/post.schema';
import { UpdatePostCommand } from '@/blog/commands/update-post.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(UpdatePostCommand)
export class UpdatePostHandler
  extends TransactionalCommandHandler<UpdatePostCommand>
  implements ICommandHandler<UpdatePostCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: UpdatePostCommand): Promise<PostDocument> {
    const { dto } = command;

    try {
      return await this.withTransaction(async (session) => {
        const post = await this.postModel
          .findById(command.postId)
          .session(session);
        if (!post) {
          throw new NotFoundException(
            `Post with id ${command.postId} not found`,
          );
        }

        if (dto.title !== undefined) post.title = dto.title;
        if (dto.slug !== undefined) post.slug = dto.slug;
        if (dto.excerpt !== undefined) post.excerpt = dto.excerpt;
        if (dto.body !== undefined) post.body = dto.body;
        if (dto.coverImageUrl !== undefined) {
          post.coverImageUrl = dto.coverImageUrl;
        }
        if (dto.categoryId !== undefined) {
          post.categoryId = new Types.ObjectId(dto.categoryId);
        }
        if (dto.tagIds !== undefined) {
          post.tagIds = dto.tagIds.map((id) => new Types.ObjectId(id));
        }
        if (dto.seoTitle !== undefined) post.seoTitle = dto.seoTitle;
        if (dto.seoDescription !== undefined) {
          post.seoDescription = dto.seoDescription;
        }
        // Supports scheduling (a future date) per the schema's own
        // comment — not just immediate publish/unpublish like
        // UpdateProductHandler's simpler boolean toggle. Explicit null
        // reverts to draft; omitted (undefined) leaves it untouched.
        if (dto.publishedAt !== undefined) {
          post.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
        }

        await post.save({ session });

        await this.outboxRepository.write(
          new PostUpdatedEvent(post.id, command.correlationId),
          session,
        );

        return post;
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A post with slug "${dto.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === MONGO_DUPLICATE_KEY_ERROR
    );
  }
}
