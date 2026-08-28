import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { UsersService } from '@/users/users.service';
import { UserEmailVerifiedEvent } from '@/auth/events/user-email-verified.event';
import { hashToken } from '@/auth/utils/token-hash.util';
import { VerifyEmailCommand } from '@/auth/commands/verify-email.command';

@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler
  extends TransactionalCommandHandler<VerifyEmailCommand>
  implements ICommandHandler<VerifyEmailCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    private readonly usersService: UsersService,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: VerifyEmailCommand): Promise<void> {
    const user = await this.usersService.findByEmailVerificationTokenHash(
      hashToken(command.token),
    );

    // Same generic message whether the token doesn't exist, was already
    // used (cleared by a prior verification), or expired — nothing here
    // needs to distinguish those cases for the caller.
    if (
      !user ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.withTransaction(async (session) => {
      await this.usersService.markEmailVerified(user.id, session);
      await this.outboxRepository.write(
        new UserEmailVerifiedEvent(user.id, user.email, command.correlationId),
        session,
      );
    });
  }
}
