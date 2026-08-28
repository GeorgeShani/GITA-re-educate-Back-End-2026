import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

import { baseSchemaOptions } from '@/common/constants/mongoose-schema.options';

export type StreamCheckpointDocument = HydratedDocument<StreamCheckpoint>;

// One row per named change stream (currently just "outbox"). Persisting
// the resume token after every batch is what lets a relay restart pick
// up exactly where it left off instead of dropping or replaying events —
// SCOPE.md B2 calls this load-bearing, not an optimization.
@Schema(baseSchemaOptions)
export class StreamCheckpoint {
  @Prop({ required: true, unique: true })
  streamName!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  resumeToken!: Record<string, unknown> | null;
}

export const StreamCheckpointSchema =
  SchemaFactory.createForClass(StreamCheckpoint);
