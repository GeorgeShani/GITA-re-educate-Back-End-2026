import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { CartItemQuantityChangedEvent } from '@/cart/events/cart-item-quantity-changed.event';
import { Cart, CartDocument } from '@/cart/schemas/cart.schema';
import { UpdateCartItemQuantityCommand } from '@/cart/commands/update-cart-item-quantity.command';

@CommandHandler(UpdateCartItemQuantityCommand)
export class UpdateCartItemQuantityHandler
  extends TransactionalCommandHandler<UpdateCartItemQuantityCommand>
  implements ICommandHandler<UpdateCartItemQuantityCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: UpdateCartItemQuantityCommand): Promise<CartDocument> {
    return this.withTransaction(async (session) => {
      const cart = await this.cartModel
        .findById(command.cartId)
        .session(session);
      if (!cart) {
        throw new NotFoundException(`Cart with id ${command.cartId} not found`);
      }

      const item = cart.items.id(command.itemId);
      if (!item) {
        throw new NotFoundException(`Cart item ${command.itemId} not found`);
      }

      item.quantity = command.quantity;
      await cart.save({ session });

      await this.outboxRepository.write(
        new CartItemQuantityChangedEvent(
          cart.id,
          command.itemId,
          command.quantity,
          command.correlationId,
        ),
        session,
      );

      return cart;
    });
  }
}
