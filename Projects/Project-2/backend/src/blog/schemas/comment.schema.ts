import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { User } from '@/users/schemas/user.schema';
import { Post } from './post.schema';

export type CommentDocument = HydratedDocument<Comment>;
export type CommentStatus = 'pending' | 'approved' | 'rejected';

// Not in SCOPE.md Phase 1's model list, but Phase 7 explicitly scopes
// "comments with moderation" and the storefront backend plan's S11
// commits to comment submission — added here to close that gap between
// the two sections rather than treat SCOPE.md's list as exhaustive.
@Schema(baseSchemaOptions)
export class Comment {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Post.name,
    required: true,
    index: true,
  })
  postId!: Types.ObjectId;

  // Guests can comment — userId is set when the commenter is logged in,
  // authorName/authorEmail are always stored either way for display.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name })
  userId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  authorName!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  authorEmail!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Comment.name })
  parentId?: Types.ObjectId; // threaded replies

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    required: true,
    default: 'pending',
    index: true,
  })
  status!: CommentStatus;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
