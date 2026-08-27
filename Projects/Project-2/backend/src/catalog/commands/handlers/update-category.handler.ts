import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { escapeRegExp } from '../../../common/utils/escape-regexp.util';
import { CategoryUpdatedEvent } from '../../events/category-updated.event';
import { Category, CategoryDocument } from '../../schemas/category.schema';
import { UpdateCategoryCommand } from '../update-category.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler
  extends TransactionalCommandHandler<UpdateCategoryCommand>
  implements ICommandHandler<UpdateCategoryCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: UpdateCategoryCommand): Promise<CategoryDocument> {
    const { dto } = command;

    try {
      return await this.withTransaction(async (session) => {
        const category = await this.categoryModel
          .findById(command.categoryId)
          .session(session);
        if (!category) {
          throw new NotFoundException(
            `Category with id ${command.categoryId} not found`,
          );
        }

        if (dto.name !== undefined) category.name = dto.name;
        if (dto.slug !== undefined) category.slug = dto.slug;
        if (dto.description !== undefined)
          category.description = dto.description;
        if (dto.position !== undefined) category.position = dto.position;
        if (dto.imageUrl !== undefined) category.imageUrl = dto.imageUrl;
        if (dto.isActive !== undefined) category.isActive = dto.isActive;

        // Present (even as explicit null, meaning "move to top-level") —
        // a re-parent, handled separately since it also rewrites every
        // descendant's path, not just this node's own fields.
        if (dto.parentId !== undefined) {
          await this.move(category, dto.parentId, session);
        }

        await category.save({ session });

        await this.outboxRepository.write(
          new CategoryUpdatedEvent(category.id, command.correlationId),
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

  private async move(
    category: CategoryDocument,
    newParentId: string | null | undefined,
    session: ClientSession,
  ): Promise<void> {
    let newParent: CategoryDocument | null = null;
    if (newParentId) {
      newParent = await this.categoryModel
        .findById(newParentId)
        .session(session);
      if (!newParent) {
        throw new NotFoundException(
          `Category with id ${newParentId} not found`,
        );
      }
      // A descendant's own path always starts with its ancestor's path —
      // moving under one would create a cycle in the tree.
      if (newParent.path.startsWith(category.path)) {
        throw new ConflictException(
          'Cannot move a category under its own descendant',
        );
      }
    }

    const oldPath = category.path;
    const newPath = `${newParent ? newParent.path : '/'}${category._id.toString()}/`;
    if (oldPath === newPath) return; // moved to the same parent it already had

    category.parentId = newParent ? newParent._id : null;
    category.path = newPath;

    const descendants = await this.categoryModel
      .find({ path: new RegExp(`^${escapeRegExp(oldPath)}`) })
      .session(session);
    for (const descendant of descendants) {
      if (descendant._id.equals(category._id)) continue; // this node, updated above
      descendant.path = newPath + descendant.path.slice(oldPath.length);
      await descendant.save({ session });
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
