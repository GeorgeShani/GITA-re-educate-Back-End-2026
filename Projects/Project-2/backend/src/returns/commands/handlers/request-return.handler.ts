import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { OrderStatus } from '@/orders/enums/order-status.enum';
import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { ReturnRequestedEvent } from '@/returns/events/return-requested.event';
import { ReturnStatus } from '@/returns/enums/return-status.enum';
import { Return, ReturnDocument } from '@/returns/schemas/return.schema';
import { RequestReturnCommand } from '@/returns/commands/request-return.command';

// Fulfillment (shipped/delivered) is admin-driven and out of scope
// (SCOPE.md Phase 6), so CONFIRMED is the only status any order reaches
// in this build today — FULFILLED/SHIPPED/DELIVERED are listed for when
// that admin surface lands, so this doesn't need revisiting then.
const RETURN_ELIGIBLE_STATUSES = new Set<OrderStatus>([
  OrderStatus.CONFIRMED,
  OrderStatus.FULFILLED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
]);

@CommandHandler(RequestReturnCommand)
export class RequestReturnHandler
  extends TransactionalCommandHandler<RequestReturnCommand>
  implements ICommandHandler<RequestReturnCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Return.name)
    private readonly returnModel: Model<ReturnDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: RequestReturnCommand): Promise<ReturnDocument> {
    return this.withTransaction(async (session) => {
      const order = await this.orderModel
        .findOne({ _id: command.orderId, userId: command.userId })
        .session(session);
      if (!order) {
        // 404, not 403 — same ownership convention as OrdersService.findOwned:
        // doesn't confirm to the caller that this order id exists at all.
        throw new NotFoundException(
          `Order with id ${command.orderId} not found`,
        );
      }

      if (!RETURN_ELIGIBLE_STATUSES.has(order.status)) {
        throw new BadRequestException(
          `Order ${order.orderNumber} is not eligible for a return in its current status (${order.status})`,
        );
      }

      if (command.items.length === 0) {
        throw new BadRequestException(
          'At least one item is required to request a return',
        );
      }

      await this.assertWithinReturnableQuantity(order, command, session);

      const [returnDoc] = await this.returnModel.create(
        [
          {
            orderId: order._id,
            userId: new Types.ObjectId(command.userId),
            status: ReturnStatus.REQUESTED,
            items: command.items.map((item) => ({
              orderItemId: new Types.ObjectId(item.orderItemId),
              quantity: item.quantity,
              reason: item.reason,
            })),
          },
        ],
        { session },
      );

      await this.outboxRepository.write(
        new ReturnRequestedEvent(
          returnDoc.id,
          command.userId,
          command.orderId,
          command.correlationId,
        ),
        session,
      );

      return returnDoc;
    });
  }

  // A rejected return doesn't consume the returnable quantity — everything
  // else (requested/approved/received/refunded) does, so a second request
  // can't re-return more of a line than was actually ordered.
  private async assertWithinReturnableQuantity(
    order: OrderDocument,
    command: RequestReturnCommand,
    session: ClientSession,
  ): Promise<void> {
    const priorReturns = await this.returnModel
      .find({ orderId: order._id, status: { $ne: ReturnStatus.REJECTED } })
      .session(session);

    const alreadyRequested = new Map<string, number>();
    for (const priorReturn of priorReturns) {
      for (const item of priorReturn.items) {
        const key = item.orderItemId.toString();
        alreadyRequested.set(
          key,
          (alreadyRequested.get(key) ?? 0) + item.quantity,
        );
      }
    }

    for (const requested of command.items) {
      const orderItem = order.items.id(requested.orderItemId);
      if (!orderItem) {
        throw new NotFoundException(
          `Order line item ${requested.orderItemId} not found on order ${order.orderNumber}`,
        );
      }

      const alreadyReturned = alreadyRequested.get(requested.orderItemId) ?? 0;
      const remaining = orderItem.quantity - alreadyReturned;
      if (requested.quantity > remaining) {
        throw new BadRequestException(
          `Cannot return ${requested.quantity} of "${orderItem.nameSnapshot}" — only ${remaining} eligible`,
        );
      }
    }
  }
}
