import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '../core/core.module';
import { AdminCouponsController } from './admin-coupons.controller';
import { CreateCouponHandler } from './commands/handlers/create-coupon.handler';
import { UpdateCouponHandler } from './commands/handlers/update-coupon.handler';
import { CouponsService } from './coupons.service';
import {
  CouponRedemption,
  CouponRedemptionSchema,
} from './schemas/coupon-redemption.schema';
import { Coupon, CouponSchema } from './schemas/coupon.schema';

const COMMAND_HANDLERS = [CreateCouponHandler, UpdateCouponHandler];

// The admin CRUD surface for a domain that, until now, only ever had
// its Coupon/CouponRedemption models injected inline by cart's
// ApplyCouponHandler, checkout's PlaceOrderHandler, and orders'
// ConfirmOrderHandler — no dedicated module existed.
@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: Coupon.name, schema: CouponSchema },
      { name: CouponRedemption.name, schema: CouponRedemptionSchema },
    ]),
  ],
  controllers: [AdminCouponsController],
  providers: [CouponsService, ...COMMAND_HANDLERS],
})
export class CouponsModule {}
