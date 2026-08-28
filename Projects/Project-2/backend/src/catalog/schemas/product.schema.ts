import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { Category } from './category.schema';

// Embedded, not top-level — SCOPE.md A9: neither has an independent
// lifecycle apart from the product they belong to. `publicId` is the
// Cloudinary asset id (S6); the LQIP/responsive URLs are derived from it
// at read time via URL transforms (f_auto,q_auto,w_*, e_blur:1000,q_1,
// w_100), never stored — see SCOPE.md Phase 2.
@Schema({ _id: true })
export class ProductImage {
  @Prop({ required: true })
  publicId!: string;

  @Prop({ required: true })
  url!: string; // Cloudinary secure_url, original/base delivery URL

  @Prop({ required: true })
  width!: number;

  @Prop({ required: true })
  height!: number;

  // Required, not optional — accessibility is graded (SCOPE.md Phase 2).
  @Prop({ required: true, trim: true })
  alt!: string;

  @Prop({ default: 0 })
  position!: number;
}
export const ProductImageSchema = SchemaFactory.createForClass(ProductImage);

// SCOPE.md A8 — variant attributes (hand, size, flex, loft, dexterity,
// colourway, material, compression, pack size) are open-ended and vary
// by category, so they're a free-form map rather than fixed columns.
@Schema({ _id: true })
export class ProductVariant {
  @Prop({ required: true, trim: true, uppercase: true })
  sku!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  attributes!: Record<string, string>; // e.g. { hand: 'left', size: '9' }

  // Money as integer minor units per SCOPE.md A9 — never floats.
  // undefined = inherits Product.basePriceMinor.
  @Prop()
  priceMinor?: number;

  @Prop()
  compareAtPriceMinor?: number; // "original" price for a strikethrough, if on sale

  @Prop()
  barcode?: string;

  @Prop()
  weightGrams?: number;

  @Prop({ default: true })
  isActive!: boolean;
}
export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);

export type ProductDocument = HydratedDocument<Product>;

@Schema(baseSchemaOptions)
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  })
  slug!: string;

  @Prop({ trim: true })
  brand?: string;

  @Prop({ required: true })
  description!: string;

  // The lowest-weighted field in Atlas Search's title > brand >
  // description > tags ranking (SCOPE.md Phase 3) — free-text attributes
  // like "waterproof" or "left-handed" that don't fit description prose
  // but should still surface a product in search.
  @Prop({ type: [String], default: [], index: true })
  tags!: string[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Category.name,
    required: true,
    index: true,
  })
  categoryId!: Types.ObjectId;

  @Prop({ required: true })
  basePriceMinor!: number;

  @Prop()
  compareAtPriceMinor?: number;

  @Prop({ type: [ProductImageSchema], default: [] })
  images!: ProductImage[];

  @Prop({ type: [ProductVariantSchema], default: [] })
  variants!: ProductVariant[];

  @Prop()
  careInstructions?: string;

  @Prop()
  specSheetUrl?: string;

  @Prop({ default: false, index: true })
  isFeatured!: boolean;

  // null = draft, not yet visible in the storefront.
  @Prop({ type: Date, default: null, index: true })
  publishedAt!: Date | null;

  @Prop({ trim: true })
  seoTitle?: string;

  @Prop({ trim: true })
  seoDescription?: string;

  @Prop()
  seoOgImageUrl?: string;

  // Denormalized, maintained by the `analytics`/review consumer — never
  // recomputed per request (SCOPE.md Phase 3 "Reviews").
  @Prop({ default: 0 })
  ratingAverage!: number;

  @Prop({ default: 0 })
  ratingCount!: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Atlas Search gets its own index via the Atlas API/UI (SCOPE.md B3
// gotcha #6) — this one is for plain equality/range filtering, not
// full-text search.
ProductSchema.index({ categoryId: 1, publishedAt: 1 });
