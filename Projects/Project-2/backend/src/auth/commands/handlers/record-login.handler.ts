import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { UsersService } from '@/users/users.service';
import { UserLoggedInEvent } from '@/auth/events/user-logged-in.event';
import { RecordLoginCommand } from '@/auth/commands/record-login.command';

@CommandHandler(RecordLoginCommand)
export class RecordLoginHandler
  extends TransactionalCommandHandler<RecordLoginCommand>
  implements ICommandHandler<RecordLoginCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    private readonly usersService: UsersService,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: RecordLoginCommand): Promise<void> {
    await this.withTransaction(async (session) => {
      await this.usersService.updateLastLogin(command.userId, session);
      await this.outboxRepository.write(
        new UserLoggedInEvent(command.userId, command.correlationId),
        session,
      );
    });
  }
}
