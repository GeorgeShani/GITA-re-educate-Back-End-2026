import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { Order } from '../../orders/schemas/order.schema';
import { PaymentStatus } from '../enums/payment-status.enum';

export type PaymentDocument = HydratedDocument<Payment>;

// Top-level — SCOPE.md A9: an order can have multiple payment attempts
// (a declined card, then a retry with a different one), and Stripe
// webhooks target a specific PaymentIntent, not an order.
@Schema(baseSchemaOptions)
export class Payment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Order.name,
    required: true,
    index: true,
  })
  orderId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['stripe', 'mock'],
    required: true,
    default: 'stripe',
  })
  provider!: 'stripe' | 'mock';

  @Prop({ index: true, sparse: true })
  providerPaymentIntentId?: string;

  @Prop({ required: true })
  amountMinor!: number;

  @Prop({ required: true, default: 'usd' })
  currency!: string;

  // type/enum explicit — see order.schema.ts's status field for why
  // (reflect-metadata's design:type inference is ambiguous for a
  // string-enum property under ts-jest specifically).
  @Prop({
    type: String,
    enum: PaymentStatus,
    required: true,
    default: PaymentStatus.INTENT_CREATED,
    index: true,
  })
  status!: PaymentStatus;

  // Stripe idempotency key for the PaymentIntent create call — SCOPE.md
  // Phase 4, prevents a retried request from creating a second intent.
  @Prop({ unique: true, sparse: true })
  idempotencyKey?: string;

  @Prop()
  failureReason?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
