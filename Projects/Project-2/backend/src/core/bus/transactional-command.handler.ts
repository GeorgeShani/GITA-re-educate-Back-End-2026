import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ICommand } from '@nestjs/cqrs';
import { ClientSession, Connection } from 'mongoose';

// Every command handler that mutates state extends this. `withTransaction`
// wraps `ClientSession.withTransaction`, which handles commit and
// transient-error retry itself — SCOPE.md's rule is "write the entity
// AND the outbox row in one transaction, then return; never publish to a
// queue inside the handler." A concrete handler looks like:
//
//   @CommandHandler(PlaceOrderCommand)
//   class PlaceOrderHandler
//     extends TransactionalCommandHandler<PlaceOrderCommand>
//     implements ICommandHandler<PlaceOrderCommand>
//   {
//     async execute(command: PlaceOrderCommand) {
//       return this.withTransaction(async (session) => {
//         const [order] = await this.orderModel.create([{...}], { session });
//         await this.outboxRepository.write(new OrderPlacedEvent(...), session);
//         return order;
//       });
//     }
//   }
//
// Note: this base class deliberately does NOT `implements ICommandHandler`
// itself — @nestjs/cqrs defines that as a conditional type keyed on the
// concrete command, which TypeScript can't resolve against a still-generic
// TCommand here (TS2422). Add `implements ICommandHandler<Concrete>` on
// each subclass instead, once TCommand is a real class.
@Injectable()
export abstract class TransactionalCommandHandler<
  TCommand extends ICommand = ICommand,
> {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  abstract execute(command: TCommand): Promise<unknown>;

  protected async withTransaction<T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }
}
