import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '@/auth/schemas/refresh-token.schema';
import { UserBannedEvent } from '@/users/events/user-banned.event';
import { UserUnbannedEvent } from '@/users/events/user-unbanned.event';
import { User, UserDocument } from '@/users/schemas/user.schema';
import { SetUserBannedCommand } from '@/users/commands/set-user-banned.command';

@CommandHandler(SetUserBannedCommand)
export class SetUserBannedHandler
  extends TransactionalCommandHandler<SetUserBannedCommand>
  implements ICommandHandler<SetUserBannedCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: SetUserBannedCommand): Promise<UserDocument> {
    return this.withTransaction(async (session) => {
      const user = await this.userModel
        .findById(command.userId)
        .session(session);
      if (!user) {
        throw new NotFoundException(`User with id ${command.userId} not found`);
      }

      user.isBanned = command.banned;
      await user.save({ session });

      if (command.banned) {
        // A banned account shouldn't have any session left able to act
        // as it — same posture as account deletion (DeleteAccountHandler)
        // and password reset. Login itself already checks isBanned too;
        // this is what stops an *already-issued* refresh token from
        // still working after a ban.
        await this.refreshTokenModel.updateMany(
          { userId: user._id, revokedAt: null },
          { revokedAt: new Date() },
          { session },
        );
      }

      await this.outboxRepository.write(
        command.banned
          ? new UserBannedEvent(user.id, command.correlationId)
          : new UserUnbannedEvent(user.id, command.correlationId),
        session,
      );

      return user;
    });
  }
}
