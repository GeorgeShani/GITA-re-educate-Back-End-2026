import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { WishlistItemRemovedEvent } from '../../events/wishlist-item-removed.event';
import {
  WishlistItem,
  WishlistItemDocument,
} from '../../schemas/wishlist-item.schema';
import { RemoveWishlistItemCommand } from '../remove-wishlist-item.command';

@CommandHandler(RemoveWishlistItemCommand)
export class RemoveWishlistItemHandler
  extends TransactionalCommandHandler<RemoveWishlistItemCommand>
  implements ICommandHandler<RemoveWishlistItemCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(WishlistItem.name)
    private readonly wishlistItemModel: Model<WishlistItemDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: RemoveWishlistItemCommand): Promise<void> {
    await this.withTransaction(async (session) => {
      const item = await this.wishlistItemModel.findOneAndDelete(
        {
          userId: new Types.ObjectId(command.userId),
          productId: new Types.ObjectId(command.productId),
        },
        { session },
      );

      if (!item) {
        // Already removed (or never wishlisted) — idempotent no-op, nothing to emit.
        return;
      }

      await this.outboxRepository.write(
        new WishlistItemRemovedEvent(
          item.id,
          command.userId,
          command.productId,
          command.correlationId,
        ),
        session,
      );
    });
  }
}
