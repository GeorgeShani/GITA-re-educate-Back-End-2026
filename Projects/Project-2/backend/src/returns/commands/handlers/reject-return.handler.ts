import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { ReturnRejectedEvent } from '@/returns/events/return-rejected.event';
import { ReturnStatus } from '@/returns/enums/return-status.enum';
import { Return, ReturnDocument } from '@/returns/schemas/return.schema';
import { RejectReturnCommand } from '@/returns/commands/reject-return.command';

@CommandHandler(RejectReturnCommand)
export class RejectReturnHandler
  extends TransactionalCommandHandler<RejectReturnCommand>
  implements ICommandHandler<RejectReturnCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Return.name)
    private readonly returnModel: Model<ReturnDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: RejectReturnCommand): Promise<ReturnDocument> {
    return this.withTransaction(async (session) => {
      const returnDoc = await this.returnModel
        .findById(command.returnId)
        .session(session);
      if (!returnDoc) {
        throw new NotFoundException(
          `Return with id ${command.returnId} not found`,
        );
      }
      if (returnDoc.status !== ReturnStatus.REQUESTED) {
        throw new ConflictException(
          `Return must be REQUESTED to reject (current status: ${returnDoc.status})`,
        );
      }

      returnDoc.status = ReturnStatus.REJECTED;
      returnDoc.adminNote = command.adminNote;
      await returnDoc.save({ session });

      await this.outboxRepository.write(
        new ReturnRejectedEvent(
          returnDoc.id,
          returnDoc.userId.toString(),
          command.adminNote,
          command.correlationId,
        ),
        session,
      );

      return returnDoc;
    });
  }
}
