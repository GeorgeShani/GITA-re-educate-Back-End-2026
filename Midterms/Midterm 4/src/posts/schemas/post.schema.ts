import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

@Schema({ timestamps: true })
export class Post {
  @Prop({
    required: true,
    trim: true
  })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true
  })
  author: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);
