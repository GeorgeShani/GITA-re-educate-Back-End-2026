import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import {
  InventoryItem,
  InventoryItemDocument,
} from '@/inventory/schemas/inventory-item.schema';
import {
  InventoryReservation,
  InventoryReservationDocument,
} from '@/inventory/schemas/inventory-reservation.schema';
import { OrderCancelledEvent } from '@/orders/events/order-cancelled.event';
import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { OrderStatus } from '@/orders/enums/order-status.enum';
import { CancelOrderCommand } from '@/orders/commands/cancel-order.command';

// SCOPE.md's checkout saga description ("on failure or 15-min
// reservation timeout -> release inventory, order.cancelled") treats
// both paths as landing on CANCELLED directly — this backend doesn't
// build a payment-retry flow (a new PaymentIntent for the same order),
// so a distinct lingering PAYMENT_FAILED status would just be a dead
// end nothing can act on. The failure reason is preserved on the order
// itself either way.
@CommandHandler(CancelOrderCommand)
export class CancelOrderHandler
  extends TransactionalCommandHandler<CancelOrderCommand>
  implements ICommandHandler<CancelOrderCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryItemModel: Model<InventoryItemDocument>,
    @InjectModel(InventoryReservation.name)
    private readonly reservationModel: Model<InventoryReservationDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: CancelOrderCommand): Promise<void> {
    await this.withTransaction(async (session) => {
      const order = await this.orderModel
        .findById(command.orderId)
        .session(session);
      if (!order) {
        throw new NotFoundException(
          `Order with id ${command.orderId} not found`,
        );
      }

      // Only PLACED orders have anything left to release — an already
      // PAID/CONFIRMED order reaching here (e.g. a late-arriving
      // payment-failed webhook for a since-superseded attempt) is a
      // no-op, not an error.
      if (order.status !== OrderStatus.PLACED) {
        return;
      }

      const reservations = await this.reservationModel
        .find({ orderId: order._id, status: 'active' })
        .session(session);

      for (const reservation of reservations) {
        await this.inventoryItemModel.updateOne(
          { _id: reservation.inventoryItemId },
          { $inc: { quantityReserved: -reservation.quantity } },
          { session },
        );
        reservation.status = 'released';
        await reservation.save({ session });
      }

      order.status = OrderStatus.CANCELLED;
      order.cancelledReason = command.reason;
      await order.save({ session });

      await this.outboxRepository.write(
        new OrderCancelledEvent(
          order.id,
          order.userId.toString(),
          command.reason,
          command.correlationId,
        ),
        session,
      );
    });
  }
}
