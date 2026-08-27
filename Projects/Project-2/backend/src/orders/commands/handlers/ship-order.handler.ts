import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { OrderShippedEvent } from '../../events/order-shipped.event';
import { OrderStatus } from '../../enums/order-status.enum';
import { Order, OrderDocument } from '../../schemas/order.schema';
import { Shipment, ShipmentDocument } from '../../schemas/shipment.schema';
import { ShipOrderCommand } from '../ship-order.command';

// v1 ships the whole order in one Shipment — no per-line partial
// fulfillment tracking (see the plan's deferred-items note). Wires up a
// schema that's been fully dormant since S3: no code anywhere else ever
// created, read, or updated a Shipment document.
@CommandHandler(ShipOrderCommand)
export class ShipOrderHandler
  extends TransactionalCommandHandler<ShipOrderCommand>
  implements ICommandHandler<ShipOrderCommand>
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

  async execute(command: ShipOrderCommand): Promise<OrderDocument> {
    return this.withTransaction(async (session) => {
      const order = await this.orderModel
        .findById(command.orderId)
        .session(session);
      if (!order) {
        throw new NotFoundException(
          `Order with id ${command.orderId} not found`,
        );
      }
      if (order.status !== OrderStatus.CONFIRMED) {
        throw new ConflictException(
          `Order ${order.orderNumber} must be CONFIRMED before it can be shipped (current status: ${order.status})`,
        );
      }

      await this.shipmentModel.create(
        [
          {
            orderId: order._id,
            status: 'shipped',
            carrier: command.dto.carrier,
            trackingNumber: command.dto.trackingNumber,
            trackingUrl: command.dto.trackingUrl,
            shippedAt: new Date(),
          },
        ],
        { session },
      );

      order.status = OrderStatus.SHIPPED;
      await order.save({ session });

      await this.outboxRepository.write(
        new OrderShippedEvent(
          order.id,
          order.userId.toString(),
          command.dto.trackingNumber,
          command.correlationId,
        ),
        session,
      );

      return order;
    });
  }
}
