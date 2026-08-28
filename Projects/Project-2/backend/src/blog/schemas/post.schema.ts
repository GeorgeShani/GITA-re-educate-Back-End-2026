import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { User } from '../../users/schemas/user.schema';
import { PostCategory } from './post-category.schema';
import { Tag } from './tag.schema';

export type PostDocument = HydratedDocument<Post>;

@Schema(baseSchemaOptions)
export class Post {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ trim: true })
  excerpt?: string;

  @Prop({ required: true })
  body!: string; // rich text, as HTML or a portable-text-style JSON blob

  @Prop()
  coverImageUrl?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  authorId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: PostCategory.name,
    index: true,
  })
  categoryId?: Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: Tag.name, default: [] })
  tagIds!: Types.ObjectId[];

  // null = draft/scheduled — a future publishedAt is how "scheduled
  // publish" (SCOPE.md Phase 7) is represented, checked at read time.
  @Prop({ type: Date, default: null, index: true })
  publishedAt!: Date | null;

  @Prop({ trim: true })
  seoTitle?: string;

  @Prop({ trim: true })
  seoDescription?: string;
}

export const PostSchema = SchemaFactory.createForClass(Post);
