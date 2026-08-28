import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { UserRolesUpdatedEvent } from '@/users/events/user-roles-updated.event';
import { User, UserDocument } from '@/users/schemas/user.schema';
import { UpdateUserRolesCommand } from '@/users/commands/update-user-roles.command';

@CommandHandler(UpdateUserRolesCommand)
export class UpdateUserRolesHandler
  extends TransactionalCommandHandler<UpdateUserRolesCommand>
  implements ICommandHandler<UpdateUserRolesCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: UpdateUserRolesCommand): Promise<UserDocument> {
    return this.withTransaction(async (session) => {
      const user = await this.userModel
        .findById(command.userId)
        .session(session);
      if (!user) {
        throw new NotFoundException(`User with id ${command.userId} not found`);
      }

      user.roles = command.roles;
      await user.save({ session });

      await this.outboxRepository.write(
        new UserRolesUpdatedEvent(
          user.id,
          command.roles,
          command.correlationId,
        ),
        session,
      );

      return user;
    });
  }
}
