import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { UsersService } from '../../../users/users.service';
import { UserDocument } from '../../../users/schemas/user.schema';
import { UserRegisteredEvent } from '../../events/user-registered.event';
import { generateRawToken, hashToken } from '../../utils/token-hash.util';
import { RegisterUserCommand } from '../register-user.command';

const VERIFICATION_TOKEN_TTL_HOURS = 24;

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler
  extends TransactionalCommandHandler<RegisterUserCommand>
  implements ICommandHandler<RegisterUserCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    private readonly usersService: UsersService,
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService,
  ) {
    super(connection);
  }

  async execute(command: RegisterUserCommand): Promise<UserDocument> {
    return this.withTransaction(async (session) => {
      const rawToken = generateRawToken();
      const emailVerificationExpiresAt = new Date(
        Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
      );

      const user = await this.usersService.create(
        {
          firstName: command.firstName,
          lastName: command.lastName,
          email: command.email,
          passwordHash: command.passwordHash,
          phone: command.phone,
          emailVerificationTokenHash: hashToken(rawToken),
          emailVerificationExpiresAt,
        },
        session,
      );

      const verificationUrl = `${this.configService.get<string>('APP_URL')}/verify-email?token=${rawToken}`;

      await this.outboxRepository.write(
        new UserRegisteredEvent(
          user.id as string,
          user.email,
          user.firstName,
          verificationUrl,
          command.correlationId,
        ),
        session,
      );

      return user;
    });
  }
}
