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
import { UserDeletedEvent } from '@/users/events/user-deleted.event';
import { User, UserDocument } from '@/users/schemas/user.schema';
import { DeleteAccountCommand } from '@/users/commands/delete-account.command';

// Soft delete + anonymize, not a hard delete — SCOPE.md A9's cascade
// rule ("app-level, not automatic"): Order/Review rows reference this
// userId and stay exactly as they are, since OrderItem/order addresses
// are already frozen snapshots that don't depend on the live User doc.
// Only genuinely-live PII gets scrubbed here.
@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler
  extends TransactionalCommandHandler<DeleteAccountCommand>
  implements ICommandHandler<DeleteAccountCommand>
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

  async execute(command: DeleteAccountCommand): Promise<void> {
    await this.withTransaction(async (session) => {
      const user = await this.userModel
        .findById(command.userId)
        .session(session);
      if (!user) {
        throw new NotFoundException(`User with id ${command.userId} not found`);
      }

      user.isDeleted = true;
      user.email = `deleted-${user.id}@deleted.invalid`;
      user.firstName = 'Deleted';
      user.lastName = 'User';
      user.phone = undefined;
      user.avatarUrl = undefined;
      user.addresses.splice(0, user.addresses.length);
      await user.save({ session });

      // A deleted account shouldn't have any session left able to act
      // as it — same posture as a password reset (S5).
      await this.refreshTokenModel.updateMany(
        { userId: user._id, revokedAt: null },
        { revokedAt: new Date() },
        { session },
      );

      await this.outboxRepository.write(
        new UserDeletedEvent(user.id, command.correlationId),
        session,
      );
    });
  }
}
