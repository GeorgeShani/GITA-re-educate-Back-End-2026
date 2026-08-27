import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { Address, AddressSchema } from '../../common/schemas/address.schema';
import { Product } from '../../catalog/schemas/product.schema';
import { User } from '../../users/schemas/user.schema';
import { OrderStatus } from '../enums/order-status.enum';

// Embedded, immutable — SCOPE.md A9's clearest embed case: an order is a
// frozen snapshot the moment it's placed. Deliberately duplicates
// name/image/price rather than referencing Product, so a later price
// change or even product deletion can never alter a past order's total.
@Schema({ _id: true })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId!: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  variantSku!: string;

  @Prop({ required: true, trim: true })
  nameSnapshot!: string;

  @Prop()
  imageUrlSnapshot?: string;

  @Prop({ required: true })
  unitPriceMinor!: number;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true })
  lineTotalMinor!: number;
}
export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

export type OrderDocument = HydratedDocument<Order>;

@Schema(baseSchemaOptions)
export class Order {
  // Short, human-readable, safe to put in a public tracking URL — the
  // raw _id isn't (SCOPE.md Phase 4 "public order-tracking page").
  @Prop({ required: true, unique: true })
  orderNumber!: string;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  userId!: Types.ObjectId;

  // Types.DocumentArray, not a plain OrderItem[] — same reasoning as
  // Cart.items (S8): Return (S10) needs order.items.id(orderItemId) to
  // validate a return request against the specific line it's returning.
  @Prop({ type: [OrderItemSchema], required: true })
  items!: Types.DocumentArray<OrderItem>;

  @Prop({ type: AddressSchema, required: true })
  shippingAddress!: Address;

  @Prop({ type: AddressSchema, required: true })
  billingAddress!: Address;

  @Prop({ required: true })
  subtotalMinor!: number;

  @Prop({ default: 0 })
  discountMinor!: number;

  @Prop({ required: true })
  shippingMinor!: number;

  @Prop({ required: true })
  taxMinor!: number;

  @Prop({ required: true })
  totalMinor!: number;

  @Prop({ required: true, default: 'usd' })
  currency!: string;

  @Prop({ trim: true, uppercase: true })
  couponCode?: string;

  @Prop({ required: true, default: OrderStatus.PLACED, index: true })
  status!: OrderStatus;

  @Prop({ type: Types.ObjectId })
  paymentId?: Types.ObjectId;

  @Prop()
  cancelledReason?: string;

  @Prop({ trim: true })
  customerNote?: string;

  // Set by the invoice queue consumer (S9) once generated — a Cloudinary
  // raw-resource URL, uploaded via StorageProvider.uploadBuffer.
  @Prop()
  invoiceUrl?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ userId: 1, createdAt: -1 });
