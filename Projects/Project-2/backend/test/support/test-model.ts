import type { Model, Schema } from 'mongoose';
import mongoose from 'mongoose';

// mongoose.model()'s own generic inference doesn't produce a type
// structurally identical to what @InjectModel's DI wiring hands a
// service at runtime (both ARE the same Model instance shape at
// runtime — the same connection, the same collection — only the
// compile-time generic inference differs), so every integration test
// needs this same cast; same "framework typing gap, not a correctness
// issue" carve-out as cloudinary-storage.provider.ts's
// CloudinaryResourceResponse casts.
//
// Guards against "Cannot overwrite model once compiled" — multiple
// spec files (or multiple describe blocks in one file) requesting the
// same schema name against the one shared mongoose connection
// MongoTestContext opens.
export function getTestModel<TDoc>(name: string, schema: Schema): Model<TDoc> {
  const existing = mongoose.models[name];
  return (existing ?? mongoose.model(name, schema)) as unknown as Model<TDoc>;
}
