import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';

export type AuditLogEntryDocument = HydratedDocument<AuditLogEntry>;

// Append-only — SCOPE.md B2 "Consumers": audit-log subscribes to every
// event (wildcard) and powers the admin activity feed (Phase 6, out of
// scope here, but the log itself is worth having from day one since it's
// also how "prove one correlation id spans the whole request" gets
// verified — see the plan's verification step 2).
@Schema(baseSchemaOptions)
export class AuditLogEntry {
  // The source outbox event's _id, as a string. Unique so a redelivered
  // BullMQ job can't create a duplicate entry — see BaseConsumer.
  @Prop({ required: true, unique: true })
  eventId!: string;

  @Prop({ required: true, index: true })
  eventName!: string;

  @Prop({ required: true })
  aggregateType!: string;

  @Prop({ required: true, index: true })
  aggregateId!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true })
  occurredAt!: Date;

  @Prop({ required: true, index: true })
  correlationId!: string;
}

export const AuditLogEntrySchema = SchemaFactory.createForClass(AuditLogEntry);
