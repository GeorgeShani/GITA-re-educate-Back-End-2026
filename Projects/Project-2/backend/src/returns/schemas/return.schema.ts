import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { Order } from '@/orders/schemas/order.schema';
import { User } from '@/users/schemas/user.schema';
import { ReturnStatus } from '@/returns/enums/return-status.enum';

// Embedded — SCOPE.md A9: a return line item has no lifecycle apart
// from its return request.
@Schema({ _id: true })
export class ReturnItem {
  // References the embedded OrderItem's own _id on the parent Order.
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  orderItemId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, trim: true })
  reason!: string;
}
export const ReturnItemSchema = SchemaFactory.createForClass(ReturnItem);

export type ReturnDocument = HydratedDocument<Return>;

@Schema(baseSchemaOptions)
export class Return {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Order.name,
    required: true,
    index: true,
  })
  orderId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: [ReturnItemSchema], required: true })
  items!: ReturnItem[];

  @Prop({
    type: String,
    enum: ReturnStatus,
    required: true,
    default: ReturnStatus.REQUESTED,
    index: true,
  })
  status!: ReturnStatus;

  // Customer-side flow is fully built here (S10); approval/rejection is
  // an admin action (Phase 6, out of scope) — this field exists so the
  // status transition has somewhere to record why once that lands.
  @Prop()
  adminNote?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  refundId?: Types.ObjectId;
}

export const ReturnSchema = SchemaFactory.createForClass(Return);
