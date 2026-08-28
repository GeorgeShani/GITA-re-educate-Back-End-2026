import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { GiftCardBalanceAdjustedEvent } from '@/gift-cards/events/gift-card-balance-adjusted.event';
import {
  GiftCard,
  GiftCardDocument,
} from '@/gift-cards/schemas/gift-card.schema';
import { AdjustGiftCardBalanceCommand } from '@/gift-cards/commands/adjust-gift-card-balance.command';

@CommandHandler(AdjustGiftCardBalanceCommand)
export class AdjustGiftCardBalanceHandler
  extends TransactionalCommandHandler<AdjustGiftCardBalanceCommand>
  implements ICommandHandler<AdjustGiftCardBalanceCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(GiftCard.name)
    private readonly giftCardModel: Model<GiftCardDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(
    command: AdjustGiftCardBalanceCommand,
  ): Promise<GiftCardDocument> {
    return this.withTransaction(async (session) => {
      const giftCard = await this.giftCardModel
        .findById(command.giftCardId)
        .session(session);
      if (!giftCard) {
        throw new NotFoundException(
          `Gift card with id ${command.giftCardId} not found`,
        );
      }

      const nextBalance = giftCard.balanceMinor + command.delta;
      if (nextBalance < 0) {
        throw new BadRequestException(
          `Adjustment would take balanceMinor negative (${giftCard.balanceMinor} + ${command.delta})`,
        );
      }

      giftCard.balanceMinor = nextBalance;
      await giftCard.save({ session });

      await this.outboxRepository.write(
        new GiftCardBalanceAdjustedEvent(
          giftCard.id,
          command.delta,
          command.correlationId,
        ),
        session,
      );

      return giftCard;
    });
  }
}
