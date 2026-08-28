import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { UsersService } from '@/users/users.service';
import { PasswordResetRequestedEvent } from '@/auth/events/password-reset-requested.event';
import { generateRawToken, hashToken } from '@/auth/utils/token-hash.util';
import { RequestPasswordResetCommand } from '@/auth/commands/request-password-reset.command';

const RESET_TOKEN_TTL_MINUTES = 60;

@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetHandler
  extends TransactionalCommandHandler<RequestPasswordResetCommand>
  implements ICommandHandler<RequestPasswordResetCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    private readonly usersService: UsersService,
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService,
  ) {
    super(connection);
  }

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const user = await this.usersService.findByEmail(command.email);

    // Silent no-op for an unknown email — the controller always returns
    // the same generic response either way, so this never leaks whether
    // an account exists.
    if (!user) return;

    await this.withTransaction(async (session) => {
      const rawToken = generateRawToken();
      const expiresAt = new Date(
        Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
      );

      await this.usersService.setPasswordResetToken(
        user.id,
        hashToken(rawToken),
        expiresAt,
        session,
      );

      const resetUrl = `${this.configService.get<string>('APP_URL')}/reset-password?token=${rawToken}`;

      await this.outboxRepository.write(
        new PasswordResetRequestedEvent(
          user.id,
          user.email,
          user.firstName,
          resetUrl,
          command.correlationId,
        ),
        session,
      );
    });
  }
}
