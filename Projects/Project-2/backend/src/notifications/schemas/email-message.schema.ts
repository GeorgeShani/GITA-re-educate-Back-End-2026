import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';

export type EmailMessageDocument = HydratedDocument<EmailMessage>;
export type EmailCategory =
  'transactional' | 'security' | 'ops' | 'marketing' | 'opt-in';
export type EmailStatus =
  'queued' | 'sent' | 'delivered' | 'bounced' | 'complained' | 'failed';

// SCOPE.md B4 — written BEFORE the provider call, so a crash mid-send is
// still visible as a `queued` row rather than nothing at all.
@Schema(baseSchemaOptions)
export class EmailMessage {
  @Prop({ required: true })
  template!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  to!: string;

  @Prop({ required: true })
  subject!: string;

  @Prop({
    type: String,
    enum: ['transactional', 'security', 'ops', 'marketing', 'opt-in'],
    required: true,
  })
  category!: EmailCategory;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  payload!: Record<string, unknown>;

  // `{template}:{aggregateId}:{eventId}`, uniquely indexed — this is
  // what stops a retried BullMQ job sending two receipts.
  @Prop({ required: true, unique: true })
  dedupeKey!: string;

  @Prop({
    type: String,
    enum: ['queued', 'sent', 'delivered', 'bounced', 'complained', 'failed'],
    required: true,
    default: 'queued',
  })
  status!: EmailStatus;

  @Prop()
  providerMessageId?: string;

  @Prop()
  error?: string;
}

export const EmailMessageSchema = SchemaFactory.createForClass(EmailMessage);
