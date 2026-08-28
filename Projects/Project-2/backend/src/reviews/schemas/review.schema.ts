import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { Product } from '@/catalog/schemas/product.schema';
import { User } from '@/users/schemas/user.schema';

export type ReviewDocument = HydratedDocument<Review>;
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

// Top-level — SCOPE.md A9: queried independently in both directions
// ("all reviews for product X", "all reviews by user Y").
@Schema(baseSchemaOptions)
export class Review {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Product.name,
    required: true,
    index: true,
  })
  productId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ trim: true })
  title?: string;

  @Prop({ required: true })
  body!: string;

  // Checked against order.paid history at submission time (SCOPE.md
  // Phase 3) — stored rather than recomputed, since a later refund
  // shouldn't retroactively unverify a review already left.
  @Prop({ default: false })
  isVerifiedPurchase!: boolean;

  // Cloudinary public_ids, via S6's upload flow.
  @Prop({ type: [String], default: [] })
  photoPublicIds!: string[];

  // Admin CRUD (moderation UI) is out of scope for the storefront
  // backend — see the plan's "Consequences of excluding admin CRUD".
  // Default here is deliberately dev-only permissive; production
  // moderation arrives with Phase 6.
  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    required: true,
    default: 'pending',
  })
  status!: ReviewStatus;

  @Prop()
  adminReply?: string;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ productId: 1, status: 1 });
