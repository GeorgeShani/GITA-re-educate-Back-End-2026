import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { OrderDeliveredEvent } from '@/orders/events/order-delivered.event';
import { OrderStatus } from '@/orders/enums/order-status.enum';
import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { Shipment, ShipmentDocument } from '@/orders/schemas/shipment.schema';
import { MarkOrderDeliveredCommand } from '@/orders/commands/mark-order-delivered.command';

@CommandHandler(MarkOrderDeliveredCommand)
export class MarkOrderDeliveredHandler
  extends TransactionalCommandHandler<MarkOrderDeliveredCommand>
  implements ICommandHandler<MarkOrderDeliveredCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Shipment.name)
    private readonly shipmentModel: Model<ShipmentDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: MarkOrderDeliveredCommand): Promise<OrderDocument> {
    return this.withTransaction(async (session) => {
      const order = await this.orderModel
        .findById(command.orderId)
        .session(session);
      if (!order) {
        throw new NotFoundException(
          `Order with id ${command.orderId} not found`,
        );
      }
      if (order.status !== OrderStatus.SHIPPED) {
        throw new ConflictException(
          `Order ${order.orderNumber} must be SHIPPED before it can be marked delivered (current status: ${order.status})`,
        );
      }

      await this.shipmentModel.updateOne(
        { orderId: order._id },
        { status: 'delivered', deliveredAt: new Date() },
        { session },
      );

      order.status = OrderStatus.DELIVERED;
      await order.save({ session });

      await this.outboxRepository.write(
        new OrderDeliveredEvent(
          order.id,
          order.userId.toString(),
          command.correlationId,
        ),
        session,
      );

      return order;
    });
  }
}
