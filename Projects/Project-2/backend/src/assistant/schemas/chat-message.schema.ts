import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { baseSchemaOptions } from '../../common/constants/mongoose-schema.options';
import { ChatSession } from './chat-session.schema';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;
export type ChatMessageRole = 'user' | 'assistant' | 'tool';

// Top-level, referencing ChatSession, rather than an embedded array —
// SCOPE.md A9 reasoning: independent pagination on long conversations,
// same as Review referencing Product. The exact tool-call/result shape
// is deliberately loose (Mixed) — S12's plan flags the @google/genai
// surface as the most likely thing to need verification against live
// docs, so this isn't locked down until that slice is actually built.
@Schema(baseSchemaOptions)
export class ChatMessage {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: ChatSession.name,
    required: true,
    index: true,
  })
  sessionId!: Types.ObjectId;

  @Prop({ type: String, enum: ['user', 'assistant', 'tool'], required: true })
  role!: ChatMessageRole;

  @Prop()
  content?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  toolCalls?: Record<string, unknown>[];

  @Prop({ type: MongooseSchema.Types.Mixed })
  toolResults?: Record<string, unknown>[];

  // Set on a mutating tool call awaiting the user's approve/decline chip
  // (SCOPE.md Phase 8's hand-rolled confirmation gate) — false once
  // resolved either way.
  @Prop({ default: false })
  pendingConfirmation!: boolean;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
