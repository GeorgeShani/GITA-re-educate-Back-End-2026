import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { CartItemRemovedEvent } from '../../events/cart-item-removed.event';
import { Cart, CartDocument } from '../../schemas/cart.schema';
import { RemoveCartItemCommand } from '../remove-cart-item.command';

@CommandHandler(RemoveCartItemCommand)
export class RemoveCartItemHandler
  extends TransactionalCommandHandler<RemoveCartItemCommand>
  implements ICommandHandler<RemoveCartItemCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: RemoveCartItemCommand): Promise<CartDocument> {
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

      item.deleteOne();
      await cart.save({ session });

      await this.outboxRepository.write(
        new CartItemRemovedEvent(
          cart.id,
          command.itemId,
          command.correlationId,
        ),
        session,
      );

      return cart;
    });
  }
}
