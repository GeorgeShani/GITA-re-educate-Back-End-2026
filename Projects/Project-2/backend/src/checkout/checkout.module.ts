import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CartModule } from '@/cart/cart.module';
import { Cart, CartSchema } from '@/cart/schemas/cart.schema';
import { CoreModule } from '@/core/core.module';
import { Coupon, CouponSchema } from '@/coupons/schemas/coupon.schema';
import {
  CouponRedemption,
  CouponRedemptionSchema,
} from '@/coupons/schemas/coupon-redemption.schema';
import {
  InventoryItem,
  InventoryItemSchema,
} from '@/inventory/schemas/inventory-item.schema';
import {
  InventoryReservation,
  InventoryReservationSchema,
} from '@/inventory/schemas/inventory-reservation.schema';
import { Order, OrderSchema } from '@/orders/schemas/order.schema';
import { ShippingModule } from '@/shipping/shipping.module';
import { TaxModule } from '@/tax/tax.module';
import { PlaceOrderHandler } from './commands/handlers/place-order.handler';
import { CheckoutController } from './checkout.controller';
import { CheckoutSaga } from './checkout.saga';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    CartModule,
    ShippingModule,
    TaxModule,
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Coupon.name, schema: CouponSchema },
      { name: CouponRedemption.name, schema: CouponRedemptionSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: InventoryReservation.name, schema: InventoryReservationSchema },
    ]),
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService, PlaceOrderHandler, CheckoutSaga],
})
export class CheckoutModule {}
