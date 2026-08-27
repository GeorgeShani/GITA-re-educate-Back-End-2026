import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CartModule } from '../cart/cart.module';
import { CoreModule } from '../core/core.module';
import { QueueName } from '../core/queues/queue-names.enum';
import { Coupon, CouponSchema } from '../coupons/schemas/coupon.schema';
import {
  CouponRedemption,
  CouponRedemptionSchema,
} from '../coupons/schemas/coupon-redemption.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from '../inventory/schemas/inventory-item.schema';
import {
  InventoryReservation,
  InventoryReservationSchema,
} from '../inventory/schemas/inventory-reservation.schema';
import {
  StockAdjustment,
  StockAdjustmentSchema,
} from '../inventory/schemas/stock-adjustment.schema';
import { MediaModule } from '../media/media.module';
import { CancelOrderHandler } from './commands/handlers/cancel-order.handler';
import { ConfirmOrderHandler } from './commands/handlers/confirm-order.handler';
import { InvoiceConsumer } from './invoice.consumer';
import { InvoicePdfService } from './invoice-pdf.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderSchema } from './schemas/order.schema';
import { StaleOrderSweepService } from './stale-order-sweep.service';

const COMMAND_HANDLERS = [ConfirmOrderHandler, CancelOrderHandler];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    CartModule,
    MediaModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: CouponRedemption.name, schema: CouponRedemptionSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: InventoryReservation.name, schema: InventoryReservationSchema },
      { name: StockAdjustment.name, schema: StockAdjustmentSchema },
    ]),
    BullModule.registerQueue({ name: QueueName.INVOICES }),
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    InvoicePdfService,
    InvoiceConsumer,
    StaleOrderSweepService,
    ...COMMAND_HANDLERS,
  ],
})
export class OrdersModule {}
