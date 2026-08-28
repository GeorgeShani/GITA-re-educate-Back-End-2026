import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { Product } from '@/catalog/schemas/product.schema';
import { User } from '@/users/schemas/user.schema';

export type WishlistItemDocument = HydratedDocument<WishlistItem>;

// Top-level rather than an array on User — SCOPE.md A9: avoids
// concurrent-array-mutation races on the User document, and "is this
// product wishlisted" is a targeted point query either way. One doc per
// (user, product) pair, enforced by the unique index below.
@Schema(baseSchemaOptions)
export class WishlistItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: true,
  })
  productId!: Types.ObjectId;
}

export const WishlistItemSchema = SchemaFactory.createForClass(WishlistItem);

WishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });
