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

  // `unknown`, not Record<string, unknown> — the MongoDB driver types a
  // change stream's own resume token as `unknown` (mongodb.d.ts:
  // `type ResumeToken = unknown`), deliberately opaque so drivers are
  // free to change its internal shape between server versions. The only
  // valid operations on it are "store it" and "pass it back to
  // resumeAfter" — treating it as a plain record was already fiction,
  // just fiction the old code cast its way past instead of admitting.
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  resumeToken!: unknown;
}

export const StreamCheckpointSchema =
  SchemaFactory.createForClass(StreamCheckpoint);
