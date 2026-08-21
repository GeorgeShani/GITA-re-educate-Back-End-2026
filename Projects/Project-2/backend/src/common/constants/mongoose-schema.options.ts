import type { SchemaOptions } from 'mongoose';

// SCOPE.md A9 — every schema in the app uses this. `timestamps: true` gives
// createdAt/updatedAt for free; the toJSON transform strips Mongo's `_id`
// and `__v` from API responses so clients only ever see `id` (virtual,
// enabled below) — ported from Homework 24/26.
export const baseSchemaOptions: SchemaOptions = {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret._id;
      delete ret.__v;
    },
  },
};
