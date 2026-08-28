import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { CategoryDeletedEvent } from '@/catalog/events/category-deleted.event';
import { Category, CategoryDocument } from '@/catalog/schemas/category.schema';
import { Product, ProductDocument } from '@/catalog/schemas/product.schema';
import { DeleteCategoryCommand } from '@/catalog/commands/delete-category.command';

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler
  extends TransactionalCommandHandler<DeleteCategoryCommand>
  implements ICommandHandler<DeleteCategoryCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: DeleteCategoryCommand): Promise<void> {
    await this.withTransaction(async (session) => {
      const category = await this.categoryModel
        .findById(command.categoryId)
        .session(session);
      if (!category) {
        throw new NotFoundException(
          `Category with id ${command.categoryId} not found`,
        );
      }

      const hasChildren = await this.categoryModel
        .exists({ parentId: category._id })
        .session(session);
      if (hasChildren) {
        throw new ConflictException(
          'Cannot delete a category that has subcategories — move or delete them first',
        );
      }

      const hasProducts = await this.productModel
        .exists({ categoryId: category._id })
        .session(session);
      if (hasProducts) {
        throw new ConflictException(
          'Cannot delete a category that has products assigned to it',
        );
      }

      await category.deleteOne({ session });

      await this.outboxRepository.write(
        new CategoryDeletedEvent(
          command.categoryId,
          category.name,
          command.correlationId,
        ),
        session,
      );
    });
  }
}
