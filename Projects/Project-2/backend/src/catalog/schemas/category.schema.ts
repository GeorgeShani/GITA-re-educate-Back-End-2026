import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';

export type CategoryDocument = HydratedDocument<Category>;

// SCOPE.md Phase 3 — materialized path tree with drag-reorder.
// `path` is a slash-joined string of ancestor ids (e.g. "/60f.../61a.../"),
// letting "all descendants of X" be a single indexed prefix-regex query
// instead of a recursive one; `$graphLookup` is the documented fallback
// if that ever falls short.
@Schema(baseSchemaOptions)
export class Category {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: Category.name, default: null })
  parentId!: Types.ObjectId | null;

  @Prop({ required: true, index: true })
  path!: string;

  @Prop({ default: 0 })
  position!: number;

  @Prop()
  imageUrl?: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
