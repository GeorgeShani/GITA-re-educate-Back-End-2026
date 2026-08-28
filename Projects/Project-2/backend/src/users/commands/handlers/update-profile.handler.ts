import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { UserProfileUpdatedEvent } from '../../events/user-profile-updated.event';
import { User, UserDocument } from '../../schemas/user.schema';
import { UpdateProfileCommand } from '../update-profile.command';

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileHandler
  extends TransactionalCommandHandler<UpdateProfileCommand>
  implements ICommandHandler<UpdateProfileCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: UpdateProfileCommand): Promise<UserDocument | null> {
    return this.withTransaction(async (session) => {
      const update: Partial<Pick<User, 'firstName' | 'lastName' | 'phone'>> =
        {};
      if (command.firstName !== undefined) update.firstName = command.firstName;
      if (command.lastName !== undefined) update.lastName = command.lastName;
      if (command.phone !== undefined) update.phone = command.phone;

      const user = await this.userModel
        .findByIdAndUpdate(command.userId, update, {
          returnDocument: 'after',
          session,
        })
        .exec();

      await this.outboxRepository.write(
        new UserProfileUpdatedEvent(command.userId, command.correlationId),
        session,
      );

      return user;
    });
  }
}
