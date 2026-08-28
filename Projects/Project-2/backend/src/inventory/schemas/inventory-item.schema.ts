import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { Product } from '../../catalog/schemas/product.schema';

export type InventoryItemDocument = HydratedDocument<InventoryItem>;

// Top-level, not embedded in Product — SCOPE.md A9: stock is queried and
// written independently and frequently (every add-to-cart, every order),
// so it needs its own atomic $inc operations rather than fighting for
// Product document locks.
@Schema(baseSchemaOptions)
export class InventoryItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: true,
    index: true,
  })
  productId!: Types.ObjectId;

  // Matches ProductVariant.sku on the parent Product's embedded array.
  @Prop({ required: true, trim: true, uppercase: true })
  variantSku!: string;

  @Prop({ required: true, default: 0, min: 0 })
  quantityOnHand!: number;

  // Denormalized — kept in sync via atomic $inc alongside
  // InventoryReservation writes, not recomputed by aggregation per
  // request. quantityAvailable = quantityOnHand - quantityReserved.
  @Prop({ required: true, default: 0, min: 0 })
  quantityReserved!: number;

  @Prop({ default: 5 })
  lowStockThreshold!: number;

  @Prop({ default: false })
  backorderAllowed!: boolean;
}

export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);

InventoryItemSchema.index({ productId: 1, variantSku: 1 }, { unique: true });
