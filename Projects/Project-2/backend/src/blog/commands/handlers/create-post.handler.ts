import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { PostCreatedEvent } from '../../events/post-created.event';
import {
  PostCategory,
  PostCategoryDocument,
} from '../../schemas/post-category.schema';
import { Post, PostDocument } from '../../schemas/post.schema';
import { CreatePostCommand } from '../create-post.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(CreatePostCommand)
export class CreatePostHandler
  extends TransactionalCommandHandler<CreatePostCommand>
  implements ICommandHandler<CreatePostCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(PostCategory.name)
    private readonly postCategoryModel: Model<PostCategoryDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: CreatePostCommand): Promise<PostDocument> {
    const { dto } = command;

    if (dto.categoryId) {
      const categoryExists = await this.postCategoryModel.exists({
        _id: dto.categoryId,
      });
      if (!categoryExists) {
        throw new NotFoundException(
          `Post category with id ${dto.categoryId} not found`,
        );
      }
    }

    try {
      return await this.withTransaction(async (session) => {
        const [post] = await this.postModel.create(
          [
            {
              title: dto.title,
              slug: dto.slug,
              excerpt: dto.excerpt,
              body: dto.body,
              coverImageUrl: dto.coverImageUrl,
              authorId: new Types.ObjectId(command.authorId),
              categoryId: dto.categoryId
                ? new Types.ObjectId(dto.categoryId)
                : undefined,
              tagIds: (dto.tagIds ?? []).map((id) => new Types.ObjectId(id)),
              publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
              seoTitle: dto.seoTitle,
              seoDescription: dto.seoDescription,
            },
          ],
          { session },
        );

        await this.outboxRepository.write(
          new PostCreatedEvent(post.id, post.title, command.correlationId),
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
