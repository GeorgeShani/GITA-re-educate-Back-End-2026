import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { User } from '../../users/schemas/user.schema';

export type MediaDocument = HydratedDocument<Media>;

// SCOPE.md Phase 2 — the registry the `media` consumer writes to on
// `media.uploaded`. width/height are Cloudinary's own detected values,
// persisted so NgOptimizedImage can reserve layout without a round-trip;
// there's no derivative-variant tracking (no media.variants_generated
// event) since Cloudinary serves every size/format on demand from
// `publicId` via URL transforms rather than pre-generated files.
@Schema(baseSchemaOptions)
export class Media {
  @Prop({ required: true, unique: true })
  publicId!: string;

  @Prop({ required: true })
  url!: string; // Cloudinary secure_url, base delivery URL

  @Prop({ required: true })
  width!: number;

  @Prop({ required: true })
  height!: number;

  @Prop({ required: true })
  format!: string; // Cloudinary-detected format, e.g. "jpg"

  @Prop({ required: true })
  bytes!: number;

  @Prop({ required: true })
  resourceType!: string; // "image" | "video" | "raw"

  // What this asset is attached to — a review photo, an avatar, a
  // product image (though product images are embedded ProductImage
  // subdocuments once attached; this row is the registry entry that
  // exists independent of where it ends up referenced).
  @Prop({ trim: true })
  ownerContext?: string; // e.g. "review", "avatar", "product"

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name })
  uploadedByUserId?: Types.ObjectId;

  @Prop({ default: false })
  isDeleted!: boolean;
}

export const MediaSchema = SchemaFactory.createForClass(Media);
