import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { CategoryCreatedEvent } from '@/catalog/events/category-created.event';
import { Category, CategoryDocument } from '@/catalog/schemas/category.schema';
import { CreateCategoryCommand } from '@/catalog/commands/create-category.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler
  extends TransactionalCommandHandler<CreateCategoryCommand>
  implements ICommandHandler<CreateCategoryCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: CreateCategoryCommand): Promise<CategoryDocument> {
    const { dto } = command;

    let parent: CategoryDocument | null = null;
    if (dto.parentId) {
      parent = await this.categoryModel.findById(dto.parentId).exec();
      if (!parent) {
        throw new NotFoundException(
          `Category with id ${dto.parentId} not found`,
        );
      }
    }

    try {
      return await this.withTransaction(async (session) => {
        // Pre-generated so `path` can be computed before the insert —
        // the scheme category.schema.ts's own comment describes
        // (parentPath + own id + '/'), which the seed script's flat-case
        // shortcut never actually implemented for nested categories.
        const newId = new Types.ObjectId();
        const path = `${parent ? parent.path : '/'}${newId.toString()}/`;

        const [category] = await this.categoryModel.create(
          [
            {
              _id: newId,
              name: dto.name,
              slug: dto.slug,
              description: dto.description,
              parentId: parent ? parent._id : null,
              path,
              position: dto.position ?? 0,
              imageUrl: dto.imageUrl,
              isActive: dto.isActive ?? true,
            },
          ],
          { session },
        );

        await this.outboxRepository.write(
          new CategoryCreatedEvent(
            category.id,
            category.name,
            command.correlationId,
          ),
          session,
        );

        return category;
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A category with slug "${dto.slug}" already exists`,
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
