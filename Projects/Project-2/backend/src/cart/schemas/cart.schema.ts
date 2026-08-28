import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { Product } from '../../catalog/schemas/product.schema';
import { User } from '../../users/schemas/user.schema';

// Embedded — SCOPE.md A9: a cart item has no lifecycle apart from its
// cart. Snapshots the product name/image/price at add-time is
// deliberately NOT done here (unlike OrderItem) — a cart should reflect
// current pricing until checkout freezes it onto the order.
@Schema({ _id: true })
export class CartItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: true,
  })
  productId!: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  variantSku!: string;

  @Prop({ required: true, min: 1 })
  quantity!: number;
}
export const CartItemSchema = SchemaFactory.createForClass(CartItem);

export type CartDocument = HydratedDocument<Cart>;

@Schema(baseSchemaOptions)
export class Cart {
  // Set once the guest cart is claimed on login (cart.merged); absent
  // for guest carts, which are found by signed cookie token instead.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, index: true })
  userId?: Types.ObjectId;

  // Guest identity — a random token embedded in a signed cookie.
  @Prop({ index: true, sparse: true })
  guestToken?: string;

  // Types.DocumentArray, not a plain CartItem[] — needed for Mongoose's
  // subdocument-array methods (.id(), push() casting a plain object,
  // etc.) that S8's command handlers rely on. Mongoose gives this at
  // runtime regardless; spelling it out here is what makes TypeScript
  // agree.
  @Prop({ type: [CartItemSchema], default: [] })
  items!: Types.DocumentArray<CartItem>;

  @Prop({ trim: true, uppercase: true })
  couponCode?: string;

  @Prop({ default: false })
  isConverted!: boolean; // true once checkout completes (cart.converted)

  @Prop({ type: Date, default: null })
  abandonedAt!: Date | null; // set by the abandoned-cart saga, S9
}

export const CartSchema = SchemaFactory.createForClass(Cart);
