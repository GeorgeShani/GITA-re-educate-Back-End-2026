import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';
import { User } from '@/users/schemas/user.schema';

export type ChatSessionDocument = HydratedDocument<ChatSession>;

@Schema(baseSchemaOptions)
export class ChatSession {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ trim: true })
  title?: string; // derived from the first user message, for a history list
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
