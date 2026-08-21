import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { Payment } from './payment.schema';

export type RefundDocument = HydratedDocument<Refund>;
export type RefundStatus = 'pending' | 'succeeded' | 'failed';

@Schema(baseSchemaOptions)
export class Refund {
  @Prop({
    type: Types.ObjectId,
    ref: Payment.name,
    required: true,
    index: true,
  })
  paymentId!: Types.ObjectId;

  @Prop({ required: true })
  amountMinor!: number;

  @Prop({ trim: true })
  reason?: string;

  @Prop({ required: true, default: 'pending' })
  status!: RefundStatus;

  @Prop({ index: true, sparse: true })
  providerRefundId?: string;
}

export const RefundSchema = SchemaFactory.createForClass(Refund);
