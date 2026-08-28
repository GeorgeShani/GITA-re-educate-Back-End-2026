import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { Product, ProductDocument } from '@/catalog/schemas/product.schema';
import { WishlistItemAddedEvent } from '@/wishlist/events/wishlist-item-added.event';
import {
  WishlistItem,
  WishlistItemDocument,
} from '@/wishlist/schemas/wishlist-item.schema';
import { AddWishlistItemCommand } from '@/wishlist/commands/add-wishlist-item.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(AddWishlistItemCommand)
export class AddWishlistItemHandler
  extends TransactionalCommandHandler<AddWishlistItemCommand>
  implements ICommandHandler<AddWishlistItemCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(WishlistItem.name)
    private readonly wishlistItemModel: Model<WishlistItemDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: AddWishlistItemCommand): Promise<void> {
    const product = await this.productModel.exists({
      _id: command.productId,
      publishedAt: { $ne: null },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with id ${command.productId} not found`,
      );
    }

    try {
      await this.withTransaction(async (session) => {
        const [item] = await this.wishlistItemModel.create(
          [
            {
              userId: new Types.ObjectId(command.userId),
              productId: new Types.ObjectId(command.productId),
            },
          ],
          { session },
        );

        await this.outboxRepository.write(
          new WishlistItemAddedEvent(
            item.id,
            command.userId,
            command.productId,
            command.correlationId,
          ),
          session,
        );
      });
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }
      // Already wishlisted — idempotent no-op, not an error.
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
