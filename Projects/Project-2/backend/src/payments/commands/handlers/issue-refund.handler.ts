import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { OrderStatus } from '../../../orders/enums/order-status.enum';
import { Order, OrderDocument } from '../../../orders/schemas/order.schema';
import { PaymentRefundedEvent } from '../../events/payment-refunded.event';
import { PaymentStatus } from '../../enums/payment-status.enum';
import { PAYMENT_PROVIDER_TOKEN } from '../../providers/payment-provider.interface';
import type { PaymentProvider } from '../../providers/payment-provider.interface';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { Refund, RefundDocument } from '../../schemas/refund.schema';
import { IssueRefundCommand } from '../issue-refund.command';

// Mirrors CreatePaymentIntentHandler's shape — the Stripe call is a real
// external side effect, so it happens BEFORE withTransaction() opens,
// never inside it (SCOPE.md B2: never do side effects inside a command
// handler's transaction).
@CommandHandler(IssueRefundCommand)
export class IssueRefundHandler
  extends TransactionalCommandHandler<IssueRefundCommand>
  implements ICommandHandler<IssueRefundCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Refund.name)
    private readonly refundModel: Model<RefundDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly paymentProvider: PaymentProvider,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: IssueRefundCommand): Promise<RefundDocument> {
    // Most recent successful attempt — an order can have multiple
    // Payment rows (a declined card, then a retry), per payment.schema.ts.
    const payment = await this.paymentModel
      .findOne({ orderId: command.orderId, status: PaymentStatus.SUCCEEDED })
      .sort({ createdAt: -1 })
      .exec();
    if (!payment?.providerPaymentIntentId) {
      throw new NotFoundException(
        `No successful payment found for order ${command.orderId}`,
      );
    }
    if (command.amountMinor > payment.amountMinor) {
      throw new BadRequestException(
        `Refund amount (${command.amountMinor}) exceeds the original payment (${payment.amountMinor})`,
      );
    }

    const providerRefund = await this.paymentProvider.createRefund(
      payment.providerPaymentIntentId,
      command.amountMinor,
      command.reason,
    );

    return this.withTransaction(async (session) => {
      const [refund] = await this.refundModel.create(
        [
          {
            paymentId: payment._id,
            amountMinor: command.amountMinor,
            reason: command.reason,
            status: 'succeeded',
            providerRefundId: providerRefund.providerRefundId,
          },
        ],
        { session },
      );

      // Full refund flips the order; a partial one leaves status alone —
      // SCOPE.md's "refunds" area doesn't distinguish further than this.
      if (command.amountMinor >= payment.amountMinor) {
        await this.orderModel.updateOne(
          { _id: command.orderId },
          { status: OrderStatus.REFUNDED },
          { session },
        );
      }

      await this.outboxRepository.write(
        new PaymentRefundedEvent(
          refund.id,
          command.orderId,
          command.amountMinor,
          command.correlationId,
        ),
        session,
      );

      return refund;
    });
  }
}
