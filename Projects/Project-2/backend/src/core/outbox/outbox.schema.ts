import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';

export type OutboxEventDocument = HydratedDocument<OutboxEvent>;

// SCOPE.md B2 — a command handler writes its entity AND this row in one
// Mongo transaction, then returns. The change-stream relay (see
// outbox-relay.service.ts) is what actually publishes it — never publish
// to BullMQ inside the same transaction.
@Schema(baseSchemaOptions)
export class OutboxEvent {
  @Prop({ required: true, index: true })
  aggregateType!: string;

  @Prop({ required: true })
  aggregateId!: string;

  @Prop({ required: true, index: true })
  eventName!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  payload!: Record<string, unknown>;

  @Prop({ required: true })
  occurredAt!: Date;

  // null = not yet published. Claimed atomically via findOneAndUpdate in
  // OutboxRepository.claim(), which is what stops two relay instances
  // from double-publishing the same row — the Mongo equivalent of
  // Postgres's `SELECT ... FOR UPDATE SKIP LOCKED`.
  @Prop({ type: Date, default: null, index: true })
  publishedAt!: Date | null;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ required: true })
  correlationId!: string;
}

export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEvent);

// Backs the startup sweep: "find unpublished rows older than N seconds"
// (the safety net for a lost resume token — see outbox-relay.service.ts).
OutboxEventSchema.index({ publishedAt: 1, occurredAt: 1 });
