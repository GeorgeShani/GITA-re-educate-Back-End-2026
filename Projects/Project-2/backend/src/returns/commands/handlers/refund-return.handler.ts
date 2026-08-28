import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { IssueRefundCommand } from '@/payments/commands/issue-refund.command';
import { RefundDocument } from '@/payments/schemas/refund.schema';
import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { ReturnRefundedEvent } from '@/returns/events/return-refunded.event';
import { ReturnStatus } from '@/returns/enums/return-status.enum';
import { Return, ReturnDocument } from '@/returns/schemas/return.schema';
import { RefundReturnCommand } from '@/returns/commands/refund-return.command';

// RECEIVED -> REFUNDED. Composes IssueRefundCommand (payments domain)
// rather than duplicating its Stripe-call-then-Refund-write logic —
// same sequential-dispatch shape checkout uses for PlaceOrder ->
// CreatePaymentIntent: this handler's own reads happen outside any
// transaction, IssueRefundCommand runs its own complete
// side-effect-then-transaction cycle, and only after that resolves does
// this handler open its own transaction for the Return status update.
// No nested transactions anywhere in the chain.
@CommandHandler(RefundReturnCommand)
export class RefundReturnHandler
  extends TransactionalCommandHandler<RefundReturnCommand>
  implements ICommandHandler<RefundReturnCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Return.name)
    private readonly returnModel: Model<ReturnDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly outboxRepository: OutboxRepository,
    private readonly commandBus: CommandBus,
  ) {
    super(connection);
  }

  async execute(command: RefundReturnCommand): Promise<ReturnDocument> {
    const returnDoc = await this.returnModel.findById(command.returnId);
    if (!returnDoc) {
      throw new NotFoundException(
        `Return with id ${command.returnId} not found`,
      );
    }
    if (returnDoc.status !== ReturnStatus.RECEIVED) {
      throw new ConflictException(
        `Return must be RECEIVED before it can be refunded (current status: ${returnDoc.status})`,
      );
    }

    const order = await this.orderModel.findById(returnDoc.orderId);
    if (!order) {
      throw new NotFoundException(
        `Order with id ${returnDoc.orderId.toString()} not found`,
      );
    }

    let amountMinor = 0;
    for (const item of returnDoc.items) {
      const orderItem = order.items.id(item.orderItemId);
      if (orderItem) amountMinor += orderItem.unitPriceMinor * item.quantity;
    }

    const refund = await this.commandBus.execute<
      IssueRefundCommand,
      RefundDocument
    >(
      new IssueRefundCommand(
        order.id,
        amountMinor,
        `Return ${returnDoc.id}`,
        command.correlationId,
      ),
    );

    return this.withTransaction(async (session) => {
      const doc = await this.returnModel
        .findById(command.returnId)
        .session(session);
      if (!doc) {
        throw new NotFoundException(
          `Return with id ${command.returnId} not found`,
        );
      }

      doc.status = ReturnStatus.REFUNDED;
      doc.refundId = refund._id;
      await doc.save({ session });

      await this.outboxRepository.write(
        new ReturnRefundedEvent(
          doc.id,
          doc.userId.toString(),
          refund.id,
          command.correlationId,
        ),
        session,
      );

      return doc;
    });
  }
}
