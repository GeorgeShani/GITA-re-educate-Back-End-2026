import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { Coupon, CouponDocument } from '@/coupons/schemas/coupon.schema';
import {
  CouponRedemption,
  CouponRedemptionDocument,
} from '@/coupons/schemas/coupon-redemption.schema';
import {
  InventoryItem,
  InventoryItemDocument,
} from '@/inventory/schemas/inventory-item.schema';
import {
  InventoryReservation,
  InventoryReservationDocument,
} from '@/inventory/schemas/inventory-reservation.schema';
import {
  StockAdjustment,
  StockAdjustmentDocument,
} from '@/inventory/schemas/stock-adjustment.schema';
import { OrderConfirmedEvent } from '@/orders/events/order-confirmed.event';
import { OrderPaidEvent } from '@/orders/events/order-paid.event';
import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { OrderStatus } from '@/orders/enums/order-status.enum';
import { ConfirmOrderCommand } from '@/orders/commands/confirm-order.command';

@CommandHandler(ConfirmOrderCommand)
export class ConfirmOrderHandler
  extends TransactionalCommandHandler<ConfirmOrderCommand>
  implements ICommandHandler<ConfirmOrderCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(InventoryItem.name)
    private readonly inventoryItemModel: Model<InventoryItemDocument>,
    @InjectModel(InventoryReservation.name)
    private readonly reservationModel: Model<InventoryReservationDocument>,
    @InjectModel(StockAdjustment.name)
    private readonly stockAdjustmentModel: Model<StockAdjustmentDocument>,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    @InjectModel(CouponRedemption.name)
    private readonly couponRedemptionModel: Model<CouponRedemptionDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: ConfirmOrderCommand): Promise<void> {
    await this.withTransaction(async (session) => {
      const order = await this.orderModel
        .findById(command.orderId)
        .session(session);
      if (!order) {
        throw new NotFoundException(
          `Order with id ${command.orderId} not found`,
        );
      }

      // Idempotent — a redelivered payment-succeeded webhook shouldn't
      // decrement stock twice. RecordPaymentResultHandler's own
      // Payment-status check catches the common case; this is the
      // order-side belt-and-suspenders equivalent.
      if (order.status !== OrderStatus.PLACED) {
        return;
      }

      order.status = OrderStatus.PAID;
      await order.save({ session });
      await this.outboxRepository.write(
        new OrderPaidEvent(
          order.id,
          order.userId.toString(),
          command.correlationId,
        ),
        session,
      );

      await this.decrementStockAndConsumeReservations(order, session);

      if (order.couponCode) {
        await this.redeemCoupon(order, session);
      }

      order.status = OrderStatus.CONFIRMED;
      await order.save({ session });
      await this.outboxRepository.write(
        new OrderConfirmedEvent(
          order.id,
          order.userId.toString(),
          command.correlationId,
        ),
        session,
      );
    });
  }

  private async decrementStockAndConsumeReservations(
    order: OrderDocument,
    session: ClientSession,
  ): Promise<void> {
    for (const item of order.items) {
      const inventoryItem = await this.inventoryItemModel
        .findOne({ productId: item.productId, variantSku: item.variantSku })
        .session(session);
      if (!inventoryItem) continue; // shouldn't happen — reservation succeeded at place-order time

      inventoryItem.quantityOnHand -= item.quantity;
      inventoryItem.quantityReserved -= item.quantity;
      await inventoryItem.save({ session });

      await this.stockAdjustmentModel.create(
        [
          {
            inventoryItemId: inventoryItem._id,
            delta: -item.quantity,
            reasonCode: 'order_paid',
            note: `Order ${order.orderNumber}`,
          },
        ],
        { session },
      );

      await this.reservationModel.updateMany(
        {
          orderId: order._id,
          inventoryItemId: inventoryItem._id,
          status: 'active',
        },
        { status: 'consumed' },
        { session },
      );
    }
  }

  private async redeemCoupon(
    order: OrderDocument,
    session: ClientSession,
  ): Promise<void> {
    const coupon = await this.couponModel
      .findOne({ code: order.couponCode })
      .session(session);
    if (!coupon) return; // deactivated/deleted between placement and confirmation — nothing to redeem

    await this.couponRedemptionModel.create(
      [
        {
          couponId: coupon._id,
          userId: order.userId,
          orderId: order._id,
          discountAppliedMinor: order.discountMinor,
        },
      ],
      { session },
    );
  }
}
