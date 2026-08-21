import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';

export type CouponDocument = HydratedDocument<Coupon>;
export type CouponType = 'percentage' | 'fixed' | 'free_shipping';

@Schema(baseSchemaOptions)
export class Coupon {
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  code!: string;

  @Prop({ required: true })
  type!: CouponType;

  // percentage: 0-100. fixed: minor units. free_shipping: ignored.
  @Prop({ required: true, default: 0 })
  value!: number;

  @Prop({ default: 0 })
  minSpendMinor!: number;

  // Empty arrays = applies store-wide.
  @Prop({ type: [Types.ObjectId], default: [] })
  productIds!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], default: [] })
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
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
