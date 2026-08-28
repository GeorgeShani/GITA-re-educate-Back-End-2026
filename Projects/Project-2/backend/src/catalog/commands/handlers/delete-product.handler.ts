import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { ProductDeletedEvent } from '@/catalog/events/product-deleted.event';
import { Product, ProductDocument } from '@/catalog/schemas/product.schema';
import { DeleteProductCommand } from '@/catalog/commands/delete-product.command';

// Hard delete — Order/Review both hold frozen name/price snapshots that
// don't depend on the live Product existing (same reasoning
// DeleteAccountHandler already applies to User). The one real risk is a
// live Cart/Wishlist referencing a product that vanishes mid-session;
// requiring unpublish first means it's already off the storefront and
// out of new carts before this runs — Wishlist's own read side already
// tolerates a missing product (returns product: null) for exactly this
// edge case.
@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler
  extends TransactionalCommandHandler<DeleteProductCommand>
  implements ICommandHandler<DeleteProductCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: DeleteProductCommand): Promise<void> {
    await this.withTransaction(async (session) => {
      const product = await this.productModel
        .findById(command.productId)
        .session(session);
      if (!product) {
        throw new NotFoundException(
          `Product with id ${command.productId} not found`,
        );
      }

      if (product.publishedAt !== null) {
        throw new ConflictException('Unpublish the product before deleting it');
      }

      await product.deleteOne({ session });

      await this.outboxRepository.write(
        new ProductDeletedEvent(
          command.productId,
          product.name,
          command.correlationId,
        ),
        session,
      );
    });
  }
}
