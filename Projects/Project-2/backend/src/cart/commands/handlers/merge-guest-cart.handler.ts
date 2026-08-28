import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { CartMergedEvent } from '@/cart/events/cart-merged.event';
import { Cart, CartDocument } from '@/cart/schemas/cart.schema';
import { MergeGuestCartCommand } from '@/cart/commands/merge-guest-cart.command';

@CommandHandler(MergeGuestCartCommand)
export class MergeGuestCartHandler
  extends TransactionalCommandHandler<MergeGuestCartCommand>
  implements ICommandHandler<MergeGuestCartCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: MergeGuestCartCommand): Promise<CartDocument | null> {
    return this.withTransaction(async (session) => {
      const guestCart = await this.cartModel
        .findOne({ guestToken: command.guestToken, isConverted: false })
        .session(session);

      if (!guestCart || guestCart.items.length === 0) {
        return null; // nothing to merge — not an error, just a no-op
      }

      // isConverted: false — same reasoning as CartService.resolveCart
      // (S9): don't fold a guest cart into an already-checked-out cart.
      let userCart = await this.cartModel
        .findOne({ userId: command.userId, isConverted: false })
        .session(session);
      userCart ??= (
        await this.cartModel.create([{ userId: command.userId, items: [] }], {
          session,
        })
      )[0];

      for (const guestItem of guestCart.items) {
        const existing = userCart.items.find(
          (item) =>
            item.productId.equals(guestItem.productId) &&
            item.variantSku === guestItem.variantSku,
        );
        if (existing) {
          existing.quantity += guestItem.quantity;
        } else {
          userCart.items.push({
            productId: guestItem.productId,
            variantSku: guestItem.variantSku,
            quantity: guestItem.quantity,
          });
        }
      }

      await userCart.save({ session });
      await this.cartModel.deleteOne({ _id: guestCart._id }, { session });

      await this.outboxRepository.write(
        new CartMergedEvent(
          userCart.id,
          command.userId,
          guestCart.items.length,
          command.correlationId,
        ),
        session,
      );

      return userCart;
    });
  }
}
