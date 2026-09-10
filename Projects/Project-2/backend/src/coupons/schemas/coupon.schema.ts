import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';

export type CouponDocument = HydratedDocument<Coupon>;
export type CouponType = 'percentage' | 'fixed' | 'free_shipping';

@Schema(baseSchemaOptions)
export class Coupon {
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  code!: string;

  @Prop({
    type: String,
    enum: ['percentage', 'fixed', 'free_shipping'],
    required: true,
  })
  type!: CouponType;

  // percentage: 0-100. fixed: minor units. free_shipping: ignored.
  @Prop({ required: true, default: 0 })
  value!: number;

  @Prop({ default: 0 })
  minSpendMinor!: number;

  // Empty arrays = applies store-wide.
  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  productIds!: Types.ObjectId[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], default: [] })
  categoryIds!: Types.ObjectId[];

  @Prop()
  perUserLimit?: number;

  @Prop()
  globalLimit?: number;

  @Prop({ default: false })
  allowStacking!: boolean;

  @Prop({ required: true })
  startsAt!: Date;

  @Prop()
  endsAt?: Date;

  @Prop({ default: true })
  isActive!: boolean;

  // Drives the one storefront-wide promo banner (home.ts's sale-banner)
  // — at most one coupon should carry this at a time, but nothing
  // enforces that at the schema level; CouponsService.findFeatured()
  // just takes the most recent match if more than one is ever set.
  @Prop({ default: false })
  isFeatured!: boolean;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
