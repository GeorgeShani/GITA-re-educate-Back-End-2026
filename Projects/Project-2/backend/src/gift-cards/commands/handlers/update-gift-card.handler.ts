import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { GiftCardUpdatedEvent } from '../../events/gift-card-updated.event';
import { GiftCard, GiftCardDocument } from '../../schemas/gift-card.schema';
import { UpdateGiftCardCommand } from '../update-gift-card.command';

@CommandHandler(UpdateGiftCardCommand)
export class UpdateGiftCardHandler
  extends TransactionalCommandHandler<UpdateGiftCardCommand>
  implements ICommandHandler<UpdateGiftCardCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(GiftCard.name)
    private readonly giftCardModel: Model<GiftCardDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: UpdateGiftCardCommand): Promise<GiftCardDocument> {
    const { dto } = command;

    return this.withTransaction(async (session) => {
      const giftCard = await this.giftCardModel
        .findById(command.giftCardId)
        .session(session);
      if (!giftCard) {
        throw new NotFoundException(
          `Gift card with id ${command.giftCardId} not found`,
        );
      }

      if (dto.expiresAt !== undefined) {
        giftCard.expiresAt = new Date(dto.expiresAt);
      }
      if (dto.isActive !== undefined) giftCard.isActive = dto.isActive;
      await giftCard.save({ session });

      await this.outboxRepository.write(
        new GiftCardUpdatedEvent(giftCard.id, command.correlationId),
        session,
      );

      return giftCard;
    });
  }
}
