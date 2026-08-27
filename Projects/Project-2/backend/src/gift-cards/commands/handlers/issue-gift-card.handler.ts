import { randomBytes } from 'node:crypto';

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { GiftCardIssuedEvent } from '../../events/gift-card-issued.event';
import { GiftCard, GiftCardDocument } from '../../schemas/gift-card.schema';
import { IssueGiftCardCommand } from '../issue-gift-card.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(IssueGiftCardCommand)
export class IssueGiftCardHandler
  extends TransactionalCommandHandler<IssueGiftCardCommand>
  implements ICommandHandler<IssueGiftCardCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(GiftCard.name)
    private readonly giftCardModel: Model<GiftCardDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: IssueGiftCardCommand): Promise<GiftCardDocument> {
    const { dto } = command;

    try {
      return await this.withTransaction(async (session) => {
        const [giftCard] = await this.giftCardModel.create(
          [
            {
              code: this.generateCode(),
              initialBalanceMinor: dto.balanceMinor,
              balanceMinor: dto.balanceMinor,
              issuedToUserId: dto.issuedToUserId
                ? new Types.ObjectId(dto.issuedToUserId)
                : undefined,
              expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
            },
          ],
          { session },
        );

        await this.outboxRepository.write(
          new GiftCardIssuedEvent(
            giftCard.id,
            giftCard.code,
            giftCard.initialBalanceMinor,
            command.correlationId,
          ),
          session,
        );

        return giftCard;
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        // Vanishingly unlikely (timestamp + random suffix) — retry once
        // rather than surface a confusing error to the caller.
        return this.execute(command);
      }
      throw error;
    }
  }

  private generateCode(): string {
    return `GIFT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
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
