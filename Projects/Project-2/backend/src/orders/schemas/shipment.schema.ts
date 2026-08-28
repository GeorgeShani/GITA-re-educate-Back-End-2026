import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { Order } from './order.schema';

export type ShipmentDocument = HydratedDocument<Shipment>;
export type ShipmentStatus = 'pending' | 'shipped' | 'delivered';

// Top-level, not embedded in Order — SCOPE.md A9: has its own
// independent-ish lookup need ("find by tracking number") and can be
// updated asynchronously by a carrier webhook that only knows the
// shipment, not the order.
@Schema(baseSchemaOptions)
export class Shipment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Order.name,
    required: true,
    index: true,
  })
  orderId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['pending', 'shipped', 'delivered'],
    required: true,
    default: 'pending',
  })
  status!: ShipmentStatus;

  @Prop({ trim: true })
  carrier?: string;

  @Prop({ trim: true, index: true, sparse: true })
  trackingNumber?: string;

  @Prop()
  trackingUrl?: string;

  @Prop()
  shippedAt?: Date;

  @Prop()
  deliveredAt?: Date;
}

export const ShipmentSchema = SchemaFactory.createForClass(Shipment);
