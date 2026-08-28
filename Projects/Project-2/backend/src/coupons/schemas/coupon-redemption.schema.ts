import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { Coupon } from './coupon.schema';
import { Order } from '@/orders/schemas/order.schema';
import { User } from '@/users/schemas/user.schema';

export type CouponRedemptionDocument = HydratedDocument<CouponRedemption>;

// Append-only usage ledger — what per-user and global usage limits are
// actually evaluated against (SCOPE.md Phase 4), rather than trusting a
// counter that could drift.
@Schema(baseSchemaOptions)
export class CouponRedemption {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Coupon.name,
    required: true,
    index: true,
  })
  couponId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Order.name,
    required: true,
  })
  orderId!: Types.ObjectId;

  @Prop({ required: true })
  discountAppliedMinor!: number;
}

export const CouponRedemptionSchema =
  SchemaFactory.createForClass(CouponRedemption);
