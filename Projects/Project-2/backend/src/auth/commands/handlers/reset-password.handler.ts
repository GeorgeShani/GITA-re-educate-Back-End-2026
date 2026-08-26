import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { UsersService } from '../../../users/users.service';
import { PasswordChangedEvent } from '../../events/password-changed.event';
import { RefreshToken, RefreshTokenDocument } from '../../schemas/refresh-token.schema';
import { hashToken } from '../../utils/token-hash.util';
import { ResetPasswordCommand } from '../reset-password.command';

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler
  extends TransactionalCommandHandler<ResetPasswordCommand>
  implements ICommandHandler<ResetPasswordCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    private readonly usersService: UsersService,
    private readonly outboxRepository: OutboxRepository,
    @InjectModel(RefreshToken.name) private readonly refreshTokenModel: Model<RefreshTokenDocument>,
  ) {
    super(connection);
  }

  async execute(command: ResetPasswordCommand): Promise<void> {
    const user = await this.usersService.findByPasswordResetTokenHash(hashToken(command.token));

    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    await this.withTransaction(async (session) => {
      await this.usersService.resetPassword(user.id as string, command.newPasswordHash, session);

      // A password reset is exactly the "account may be compromised"
      // signal reuse-detection exists for — revoke every refresh token
      // so a stolen session can't outlive the password that granted it.
      await this.refreshTokenModel.updateMany(
        { userId: user._id, revokedAt: null },
        { revokedAt: new Date() },
        { session },
      );

      await this.outboxRepository.write(
        new PasswordChangedEvent(user.id as string, user.email, command.correlationId),
        session,
      );
    });
  }
}
