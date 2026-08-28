import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';

export type PostCategoryDocument = HydratedDocument<PostCategory>;

@Schema(baseSchemaOptions)
export class PostCategory {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug!: string;
}

export const PostCategorySchema = SchemaFactory.createForClass(PostCategory);
