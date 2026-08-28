import mongoose from 'mongoose';

import { MongoTestContext } from '../../test/support/mongo-memory-server';
import { getTestModel } from '../../test/support/test-model';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import {
  OutboxEvent,
  OutboxEventDocument,
  OutboxEventSchema,
} from '@/core/outbox/outbox.schema';
import {
  CouponRedemption,
  CouponRedemptionDocument,
  CouponRedemptionSchema,
} from '@/coupons/schemas/coupon-redemption.schema';
import {
  Coupon,
  CouponDocument,
  CouponSchema,
} from '@/coupons/schemas/coupon.schema';
import {
  InventoryItem,
  InventoryItemDocument,
  InventoryItemSchema,
} from '@/inventory/schemas/inventory-item.schema';
import {
  InventoryReservation,
  InventoryReservationDocument,
  InventoryReservationSchema,
} from '@/inventory/schemas/inventory-reservation.schema';
import {
  StockAdjustment,
  StockAdjustmentDocument,
  StockAdjustmentSchema,
} from '@/inventory/schemas/stock-adjustment.schema';
import { CancelOrderCommand } from './commands/cancel-order.command';
import { CancelOrderHandler } from './commands/handlers/cancel-order.handler';
import { ConfirmOrderCommand } from './commands/confirm-order.command';
import { ConfirmOrderHandler } from './commands/handlers/confirm-order.handler';
import { OrderStatus } from './enums/order-status.enum';
import { Order, OrderDocument, OrderSchema } from './schemas/order.schema';

const PRODUCT_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();
const VARIANT_SKU = 'GLV-001-L';

// SCOPE.md Part D priorities #1 ("the checkout saga's compensating path
// — payment fails -> inventory released -> order cancelled") and #8
// ("order state-machine illegal transitions"). Exercises the real
// handlers against a real replica set — this is exactly the machinery
// the checkout saga (ConfirmOrderHandler on payment.succeeded,
// CancelOrderHandler on payment.failed/reservation timeout) runs in
// production, just invoked directly instead of via CommandBus/webhook.
describe('Order state machine (integration)', () => {
  let ctx: MongoTestContext;
  let orderModel: mongoose.Model<OrderDocument>;
  let inventoryItemModel: mongoose.Model<InventoryItemDocument>;
  let reservationModel: mongoose.Model<InventoryReservationDocument>;
  let stockAdjustmentModel: mongoose.Model<StockAdjustmentDocument>;
  let couponModel: mongoose.Model<CouponDocument>;
  let couponRedemptionModel: mongoose.Model<CouponRedemptionDocument>;
  let outboxRepository: OutboxRepository;
  let confirmHandler: ConfirmOrderHandler;
  let cancelHandler: CancelOrderHandler;

  beforeAll(async () => {
    ctx = await MongoTestContext.start();
    orderModel = getTestModel<OrderDocument>(Order.name, OrderSchema);
    inventoryItemModel = getTestModel<InventoryItemDocument>(
      InventoryItem.name,
      InventoryItemSchema,
    );
    reservationModel = getTestModel<InventoryReservationDocument>(
      InventoryReservation.name,
      InventoryReservationSchema,
    );
    stockAdjustmentModel = getTestModel<StockAdjustmentDocument>(
      StockAdjustment.name,
      StockAdjustmentSchema,
    );
    couponModel = getTestModel<CouponDocument>(Coupon.name, CouponSchema);
    couponRedemptionModel = getTestModel<CouponRedemptionDocument>(
      CouponRedemption.name,
      CouponRedemptionSchema,
    );
    const outboxModel = getTestModel<OutboxEventDocument>(
      OutboxEvent.name,
      OutboxEventSchema,
    );
    outboxRepository = new OutboxRepository(outboxModel);

    confirmHandler = new ConfirmOrderHandler(
      mongoose.connection,
      orderModel,
      inventoryItemModel,
      reservationModel,
      stockAdjustmentModel,
      couponModel,
      couponRedemptionModel,
      outboxRepository,
    );
    cancelHandler = new CancelOrderHandler(
      mongoose.connection,
      orderModel,
      inventoryItemModel,
      reservationModel,
      outboxRepository,
    );
  }, 120_000);

  afterEach(async () => {
    await ctx.reset();
  });

  afterAll(async () => {
    await ctx.stop();
  });

  async function seedPlacedOrder(): Promise<{
    order: OrderDocument;
    inventoryItem: InventoryItemDocument;
  }> {
    const inventoryItem = await inventoryItemModel.create({
      productId: PRODUCT_ID,
      variantSku: VARIANT_SKU,
      quantityOnHand: 10,
      quantityReserved: 2,
      lowStockThreshold: 3,
    });

    const address = {
      fullName: 'Ada Lovelace',
      line1: '1 Analytical Engine Way',
      city: 'London',
      postalCode: 'SW1A 1AA',
      countryCode: 'GB',
    };

    const order = await orderModel.create({
      orderNumber: `TEST-${Date.now()}`,
      userId: USER_ID,
      items: [
        {
          productId: PRODUCT_ID,
          variantSku: VARIANT_SKU,
          nameSnapshot: 'Waterproof Golf Glove',
          unitPriceMinor: 2499,
          quantity: 2,
          lineTotalMinor: 4998,
        },
      ],
      shippingAddress: address,
      billingAddress: address,
      subtotalMinor: 4998,
      shippingMinor: 500,
      taxMinor: 400,
      totalMinor: 5898,
      status: OrderStatus.PLACED,
    });

    await reservationModel.create({
      inventoryItemId: inventoryItem._id,
      orderId: order._id,
      quantity: 2,
      status: 'active',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    return { order, inventoryItem };
  }

  describe('compensation: payment fails -> inventory released -> order cancelled', () => {
    it('releases the reservation, decrements quantityReserved, and cancels the order', async () => {
      const { order, inventoryItem } = await seedPlacedOrder();

      await cancelHandler.execute(
        new CancelOrderCommand(order.id, 'payment_failed', 'corr-cancel'),
      );

      const reloadedOrder = await orderModel.findById(order._id);
      expect(reloadedOrder?.status).toBe(OrderStatus.CANCELLED);
      expect(reloadedOrder?.cancelledReason).toBe('payment_failed');

      const reloadedItem = await inventoryItemModel.findById(inventoryItem._id);
      // Started at 2 reserved (pre-existing) + this order's own
      // reservation never actually got double-counted in quantityReserved
      // by seedPlacedOrder (the reservation row is separate bookkeeping)
      // — cancellation subtracts exactly this order's 2 units.
      expect(reloadedItem?.quantityReserved).toBe(0);

      const reloadedReservation = await reservationModel.findOne({
        orderId: order._id,
      });
      expect(reloadedReservation?.status).toBe('released');
    });

    it('is a no-op on an order that is not PLACED (illegal transition guard)', async () => {
      const { order, inventoryItem } = await seedPlacedOrder();
      await orderModel.updateOne(
        { _id: order._id },
        { status: OrderStatus.CONFIRMED },
      );

      await cancelHandler.execute(
        new CancelOrderCommand(order.id, 'late_webhook', 'corr-cancel-2'),
      );

      const reloadedOrder = await orderModel.findById(order._id);
      // Stayed CONFIRMED — a stale/late cancellation attempt must never
      // downgrade an order that already moved past PLACED.
      expect(reloadedOrder?.status).toBe(OrderStatus.CONFIRMED);
      expect(reloadedOrder?.cancelledReason).toBeUndefined();

      const reloadedReservation = await reservationModel.findOne({
        orderId: order._id,
      });
      // Untouched — the reservation was already consumed by confirmation
      // in a real flow; this guard is what stops a late cancel from
      // releasing stock that's already been sold.
      expect(reloadedReservation?.status).toBe('active');
      const reloadedItem = await inventoryItemModel.findById(inventoryItem._id);
      expect(reloadedItem?.quantityReserved).toBe(2);
    });
  });

  describe('confirmation: payment succeeds -> stock decremented -> order confirmed', () => {
    it('decrements quantityOnHand/quantityReserved, writes a StockAdjustment, and confirms the order', async () => {
      const { order, inventoryItem } = await seedPlacedOrder();

      await confirmHandler.execute(
        new ConfirmOrderCommand(order.id, 'corr-confirm'),
      );

      const reloadedOrder = await orderModel.findById(order._id);
      expect(reloadedOrder?.status).toBe(OrderStatus.CONFIRMED);

      const reloadedItem = await inventoryItemModel.findById(inventoryItem._id);
      expect(reloadedItem?.quantityOnHand).toBe(8); // 10 - 2
      expect(reloadedItem?.quantityReserved).toBe(0); // 2 - 2

      const adjustments = await stockAdjustmentModel.find({
        inventoryItemId: inventoryItem._id,
      });
      expect(adjustments).toHaveLength(1);
      expect(adjustments[0].delta).toBe(-2);
      expect(adjustments[0].reasonCode).toBe('order_paid');

      const reloadedReservation = await reservationModel.findOne({
        orderId: order._id,
      });
      expect(reloadedReservation?.status).toBe('consumed');
    });

    it('is idempotent — confirming an already-CONFIRMED order does not double-decrement stock', async () => {
      const { order, inventoryItem } = await seedPlacedOrder();

      await confirmHandler.execute(
        new ConfirmOrderCommand(order.id, 'corr-confirm-a'),
      );
      // Simulates a redelivered payment-succeeded webhook for the same order.
      await confirmHandler.execute(
        new ConfirmOrderCommand(order.id, 'corr-confirm-b'),
      );

      const reloadedItem = await inventoryItemModel.findById(inventoryItem._id);
      expect(reloadedItem?.quantityOnHand).toBe(8); // still -2, not -4
      expect(reloadedItem?.quantityReserved).toBe(0);

      const adjustments = await stockAdjustmentModel.find({
        inventoryItemId: inventoryItem._id,
      });
      expect(adjustments).toHaveLength(1); // not 2
    });

    it('redeems the coupon exactly once when the order has one applied', async () => {
      const coupon = await couponModel.create({
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        startsAt: new Date(Date.now() - 1000),
        isActive: true,
      });
      const { order } = await seedPlacedOrder();
      await orderModel.updateOne(
        { _id: order._id },
        { couponCode: coupon.code, discountMinor: 500 },
      );
      const reloaded = await orderModel.findById(order._id);
      if (!reloaded) throw new Error('order not found');

      await confirmHandler.execute(
        new ConfirmOrderCommand(reloaded.id, 'corr-coupon'),
      );

      const redemptions = await couponRedemptionModel.find({
        couponId: coupon._id,
      });
      expect(redemptions).toHaveLength(1);
      expect(redemptions[0].discountAppliedMinor).toBe(500);
      expect(redemptions[0].orderId.toString()).toBe(order.id);
    });
  });
});
