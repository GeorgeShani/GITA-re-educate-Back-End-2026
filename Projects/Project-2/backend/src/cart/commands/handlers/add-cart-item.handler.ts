import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { Product, ProductDocument } from '@/catalog/schemas/product.schema';
import { CartItemAddedEvent } from '@/cart/events/cart-item-added.event';
import { Cart, CartDocument } from '@/cart/schemas/cart.schema';
import { AddCartItemCommand } from '@/cart/commands/add-cart-item.command';

@CommandHandler(AddCartItemCommand)
export class AddCartItemHandler
  extends TransactionalCommandHandler<AddCartItemCommand>
  implements ICommandHandler<AddCartItemCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: AddCartItemCommand): Promise<CartDocument> {
    const product = await this.productModel.findOne({
      _id: command.productId,
      publishedAt: { $ne: null },
    });
    if (!product) {
      throw new NotFoundException(
        `Product with id ${command.productId} not found`,
      );
    }

    const variant = product.variants.find(
      (v) => v.sku === command.variantSku.toUpperCase() && v.isActive,
    );
    if (!variant) {
      throw new BadRequestException(
        `Variant "${command.variantSku}" is not available for this product`,
      );
    }

    return this.withTransaction(async (session) => {
      const cart = await this.cartModel
        .findById(command.cartId)
        .session(session);
      if (!cart) {
        throw new NotFoundException(`Cart with id ${command.cartId} not found`);
      }

      const existing = cart.items.find(
        (item) =>
          item.productId.equals(command.productId) &&
          item.variantSku === variant.sku,
      );
      if (existing) {
        existing.quantity += command.quantity;
      } else {
        cart.items.push({
          productId: new Types.ObjectId(command.productId),
          variantSku: variant.sku,
          quantity: command.quantity,
        });
      }

      await cart.save({ session });

      await this.outboxRepository.write(
        new CartItemAddedEvent(
          cart.id,
          command.productId,
          variant.sku,
          command.quantity,
          command.correlationId,
        ),
        session,
      );

      return cart;
    });
  }
}
