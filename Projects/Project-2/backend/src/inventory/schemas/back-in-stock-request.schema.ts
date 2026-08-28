import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { Product } from '../../catalog/schemas/product.schema';

export type BackInStockRequestDocument = HydratedDocument<BackInStockRequest>;

// email, not userId — SCOPE.md B4 "Back in stock" goes to a "Waitlist"
// category, and guests (not logged in) can sign up for the alert too.
@Schema(baseSchemaOptions)
export class BackInStockRequest {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: true,
    index: true,
  })
  productId!: Types.ObjectId;

  @Prop({ trim: true, uppercase: true })
  variantSku?: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ default: false })
  notified!: boolean;
}

export const BackInStockRequestSchema =
  SchemaFactory.createForClass(BackInStockRequest);

BackInStockRequestSchema.index(
  { productId: 1, variantSku: 1, email: 1 },
  { unique: true },
);
