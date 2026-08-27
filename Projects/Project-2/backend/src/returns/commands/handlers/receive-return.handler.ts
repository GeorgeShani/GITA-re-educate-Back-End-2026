import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { ReturnReceivedEvent } from '../../events/return-received.event';
import { ReturnStatus } from '../../enums/return-status.enum';
import { Return, ReturnDocument } from '../../schemas/return.schema';
import { ReceiveReturnCommand } from '../receive-return.command';

// APPROVED -> RECEIVED — the point at which the returned goods are
// physically back, a separate step from approval since the two can be
// days apart (approval happens from the RMA queue; receiving happens
// at the warehouse).
@CommandHandler(ReceiveReturnCommand)
export class ReceiveReturnHandler
  extends TransactionalCommandHandler<ReceiveReturnCommand>
  implements ICommandHandler<ReceiveReturnCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Return.name)
    private readonly returnModel: Model<ReturnDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: ReceiveReturnCommand): Promise<ReturnDocument> {
    return this.withTransaction(async (session) => {
      const returnDoc = await this.returnModel
        .findById(command.returnId)
        .session(session);
      if (!returnDoc) {
        throw new NotFoundException(
          `Return with id ${command.returnId} not found`,
        );
      }
      if (returnDoc.status !== ReturnStatus.APPROVED) {
        throw new ConflictException(
          `Return must be APPROVED before it can be received (current status: ${returnDoc.status})`,
        );
      }

      returnDoc.status = ReturnStatus.RECEIVED;
      await returnDoc.save({ session });

      await this.outboxRepository.write(
        new ReturnReceivedEvent(
          returnDoc.id,
          returnDoc.userId.toString(),
          command.correlationId,
        ),
        session,
      );

      return returnDoc;
    });
  }
}
